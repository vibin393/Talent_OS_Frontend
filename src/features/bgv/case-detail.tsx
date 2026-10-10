"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Checkbox,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  Tab,
  TabList,
  type TableColumnDefinition,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { ArrowDownload16Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ErrorBar, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { useMe } from "@/features/auth/use-me";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { bgvApi, bgvKeys } from "./api";
import {
  adjudicateGuard,
  CASE_STATUS_COLORS,
  CASE_STATUS_LABELS,
  CHECK_STATUS_COLORS,
  CHECK_STATUS_LABELS,
  CHECK_TYPE_LABELS,
  formatDate,
  isActiveCase,
  MIN_REASONS,
  reasonsError,
  SEVERITY_COLORS,
  summariseDeclaration,
} from "./logic";
import { BgvFollowUpsCard } from "@/features/agents/compliance/bgv-follow-ups-card";
import type { BgvCheck, CaseOut, CheckResult, Discrepancy, DocumentRequest, Severity } from "./types";

const useStyles = makeStyles({
  header: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "center", marginBottom: tokens.spacingVerticalM },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, marginLeft: "auto" },
  tabs: { marginBottom: tokens.spacingVerticalM },
  cellActions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
  proposal: { padding: tokens.spacingHorizontalM, backgroundColor: tokens.colorNeutralBackground3, gap: tokens.spacingVerticalXS },
  timeline: { listStyleType: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  overdue: { color: tokens.colorPaletteRedForeground1 },
});

type Dialogs =
  | { kind: "record"; check: BgvCheck }
  | { kind: "waive"; check: BgvCheck }
  | { kind: "resolve"; discrepancy: Discrepancy }
  | { kind: "return"; doc: DocumentRequest }
  | { kind: "adjudicate" }
  | { kind: "cancel" }
  | null;

/** `/bgv/[id]`: case header (Start / Adjudicate / Cancel) and tabs Checks, Documents, Discrepancies, Timeline. */
export function BgvCaseDetail({ id }: { id: string }) {
  const styles = useStyles();
  const canRead = usePermission("bgv:read");
  const canManage = usePermission("bgv:manage");
  const canAdjudicate = usePermission("bgv:adjudicate");
  const [tab, setTab] = useState("checks");
  const [dialog, setDialog] = useState<Dialogs>(null);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: bgvKeys.case(id), queryFn: ({ signal }) => bgvApi.get(id, signal), enabled: canRead });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: bgvKeys.case(id) });
    void qc.invalidateQueries({ queryKey: bgvKeys.timeline(id) });
  };
  const start = useMutation({ mutationFn: () => bgvApi.start(id), onSuccess: refresh });
  if (!canRead) return <NoAccess what="background verification" />;
  if (q.isPending) return <Body1>Loading…</Body1>;
  if (q.isError) return <ErrorBar title="Could not load the case." message={errorMessage(q.error)} />;
  const c = q.data;
  const guard = adjudicateGuard(c);
  return (
    <>
      <PageHeader title={`BGV ${c.human_id}`} subtitle={`${c.candidate_name ?? "Candidate"} · ${c.package_name ?? "Package"}`} />
      <div className={styles.header}>
        <Badge size="large" appearance="tint" color={CASE_STATUS_COLORS[c.status]}>
          {CASE_STATUS_LABELS[c.status]}
          {c.outcome_qualifier === "with_exceptions" ? " (with exceptions)" : ""}
        </Badge>
        <Caption1>{c.required ? "Required for the placement start gate" : "Ad-hoc case (no blocking gate)"}</Caption1>
        {!c.consent_active && c.status !== "initiated" && <Badge color="danger">No active consent</Badge>}
        <div className={styles.actions}>
          {canManage && c.status === "initiated" && (
            <Button appearance="primary" disabled={start.isPending} onClick={() => start.mutate()}>
              Start
            </Button>
          )}
          {canAdjudicate && (guard.canClear || c.status === "discrepancy") && (
            <Button appearance="primary" onClick={() => setDialog({ kind: "adjudicate" })}>
              Adjudicate
            </Button>
          )}
          {canManage && (c.status === "initiated" || isActiveCase(c.status)) && (
            <Button onClick={() => setDialog({ kind: "cancel" })}>Cancel case</Button>
          )}
        </div>
      </div>
      {start.isError && <ErrorBar message={errorMessage(start.error)} />}
      {c.status === "failed" && c.placement_id && (
        <MessageBar intent="warning">
          <MessageBarBody>A failed BGV never drops the placement automatically. Use the placement&apos;s Drop action (reason: BGV failed) if needed.</MessageBarBody>
        </MessageBar>
      )}
      {c.adjudication_reasons && (
        <Card>
          <Text weight="semibold">Adjudication reasons</Text>
          <Body1>{c.adjudication_reasons}</Body1>
          <Caption1>Evidence kept until {formatDate(c.evidence_purge_after)}</Caption1>
        </Card>
      )}
      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))}>
        <Tab value="checks">Checks ({c.checks.length})</Tab>
        <Tab value="documents">Documents ({c.documents.length})</Tab>
        <Tab value="discrepancies">Discrepancies ({c.discrepancies.length})</Tab>
        <Tab value="timeline">Timeline</Tab>
      </TabList>
      {tab === "checks" && <BgvFollowUpsCard caseId={id} />}
      {tab === "checks" && <ChecksTab c={c} canManage={canManage} canAdjudicate={canAdjudicate} onDialog={setDialog} onChanged={refresh} />}
      {tab === "documents" && <DocumentsTab c={c} canManage={canManage} onDialog={setDialog} onChanged={refresh} />}
      {tab === "discrepancies" && <DiscrepanciesTab c={c} canManage={canManage} onDialog={setDialog} />}
      {tab === "timeline" && <TimelineTab id={id} />}
      {dialog?.kind === "record" && <RecordDialog check={dialog.check} onClose={() => setDialog(null)} onDone={refresh} />}
      {dialog?.kind === "waive" && <WaiveDialog check={dialog.check} onClose={() => setDialog(null)} onDone={refresh} />}
      {dialog?.kind === "resolve" && <ResolveDialog discrepancy={dialog.discrepancy} onClose={() => setDialog(null)} onDone={refresh} />}
      {dialog?.kind === "return" && <ReturnDialog caseId={c.id} doc={dialog.doc} onClose={() => setDialog(null)} onDone={refresh} />}
      {dialog?.kind === "adjudicate" && <AdjudicateDialog c={c} onClose={() => setDialog(null)} onDone={refresh} />}
      {dialog?.kind === "cancel" && <CancelDialog caseId={c.id} onClose={() => setDialog(null)} onDone={refresh} />}
    </>
  );
}

// ---------------------------------------------------------------- checks
function ChecksTab({
  c,
  canManage,
  canAdjudicate,
  onDialog,
  onChanged,
}: {
  c: CaseOut;
  canManage: boolean;
  canAdjudicate: boolean;
  onDialog: (d: Dialogs) => void;
  onChanged: () => void;
}) {
  const styles = useStyles();
  const me = useMe();
  const providers = useQuery({ queryKey: bgvKeys.providers, queryFn: ({ signal }) => bgvApi.providers(signal), enabled: canManage });
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const active = isActiveCase(c.status) || c.status === "initiated";
  const columns: TableColumnDefinition<BgvCheck>[] = [
    createTableColumn({
      columnId: "check",
      renderHeaderCell: () => "Check",
      renderCell: (k) => (
        <span>
          <Text weight="semibold">{CHECK_TYPE_LABELS[k.type]}</Text>
          <br />
          <Caption1>{k.subject_label}</Caption1>
        </span>
      ),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (k) => (
        <span>
          <Badge appearance="tint" color={CHECK_STATUS_COLORS[k.status]}>
            {CHECK_STATUS_LABELS[k.status]}
          </Badge>
          {k.halted_reason && <Caption1> · halted ({k.halted_reason.replaceAll("_", " ")})</Caption1>}
        </span>
      ),
    }),
    createTableColumn({
      columnId: "assignee",
      renderHeaderCell: () => "Assigned to",
      renderCell: (k) =>
        canManage && active && (k.status === "pending" || k.status === "in_progress") ? (
          <Dropdown
            aria-label={`Assign ${k.subject_label}`}
            placeholder="Assign…"
            value={k.assignee_kind === "provider" ? (k.provider_name ?? "Provider") : k.assignee_kind === "internal" ? "Internal verifier" : ""}
            onOptionSelect={(_, d) => {
              const v = String(d.optionValue);
              void run(() =>
                v === "me"
                  ? bgvApi.assign(k.id, { assignee_kind: "internal", assignee_user_id: me.data?.user.id })
                  : bgvApi.assign(k.id, { assignee_kind: "provider", provider_id: v }),
              );
            }}
          >
            <Option value="me">Me (internal verifier)</Option>
            {(providers.data ?? [])
              .filter((p) => p.active && (p.supported_types.length === 0 || p.supported_types.includes(k.type)))
              .map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.name}
                </Option>
              ))}
          </Dropdown>
        ) : (
          (k.provider_name ?? (k.assignee_kind === "internal" ? "Internal verifier" : "—"))
        ),
    }),
    createTableColumn({
      columnId: "due",
      renderHeaderCell: () => "Due",
      renderCell: (k) => <span className={mergeClasses(k.overdue && styles.overdue)}>{formatDate(k.due_on)}{k.overdue ? " (overdue)" : ""}</span>,
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (k) => (
        <div className={styles.cellActions}>
          {canManage && isActiveCase(c.status) && (k.status === "pending" || (k.status === "in_progress" && k.halted_reason)) && (
            <Button size="small" disabled={!k.assignee_kind} onClick={() => void run(() => bgvApi.startCheck(k.id))}>
              Start
            </Button>
          )}
          {canManage && isActiveCase(c.status) && k.status === "in_progress" && !k.halted_reason && (
            <Button size="small" appearance="primary" onClick={() => onDialog({ kind: "record", check: k })}>
              Record result
            </Button>
          )}
          {canManage && k.status === "in_progress" && (
            <Button size="small" as="a" href={bgvApi.packetHref(k.id)} icon={<ArrowDownload16Regular />}>
              Packet
            </Button>
          )}
          {canAdjudicate && isActiveCase(c.status) && ["pending", "in_progress", "unable_to_verify"].includes(k.status) && (
            <Button size="small" onClick={() => onDialog({ kind: "waive", check: k })}>
              Waive
            </Button>
          )}
        </div>
      ),
    }),
  ];
  return (
    <>
      <ErrorBar message={error} />
      <AdminGrid items={c.checks} columns={columns} getRowId={(k) => k.id} loading={false} error={null} emptyText="No checks." label="Checks" />
    </>
  );
}

// ---------------------------------------------------------------- documents
function DocumentsTab({ c, canManage, onDialog, onChanged }: { c: CaseOut; canManage: boolean; onDialog: (d: Dialogs) => void; onChanged: () => void }) {
  const styles = useStyles();
  const [error, setError] = useState<string | null>(null);
  const [redacted, setRedacted] = useState(false);
  const accept = async (doc: DocumentRequest) => {
    setError(null);
    try {
      await bgvApi.reviewDocument(c.id, doc.key, "accept", null, doc.key === "aadhaar" ? redacted : false);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const columns: TableColumnDefinition<DocumentRequest>[] = [
    createTableColumn({ columnId: "label", renderHeaderCell: () => "Document", renderCell: (d) => d.label }),
    createTableColumn({ columnId: "kind", renderHeaderCell: () => "Kind", renderCell: (d) => (d.kind === "upload" ? `${d.file_ids.length} file(s)` : "Declaration") }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (d) => <Badge appearance="tint">{d.status}</Badge> }),
    createTableColumn({
      columnId: "declared",
      renderHeaderCell: () => "Details",
      renderCell: (d) => (d.declared ? <Caption1>{summariseDeclaration(d.declared)}</Caption1> : (d.return_note ?? "—")),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "Review",
      renderCell: (d) =>
        canManage && d.status === "submitted" ? (
          <div className={styles.cellActions}>
            {d.key === "aadhaar" && d.file_ids.length > 0 && (
              <Checkbox label="Image is redacted" checked={redacted} onChange={(_, v) => setRedacted(Boolean(v.checked))} />
            )}
            <Button size="small" appearance="primary" onClick={() => void accept(d)}>
              Accept
            </Button>
            <Button size="small" onClick={() => onDialog({ kind: "return", doc: d })}>
              Return
            </Button>
          </div>
        ) : null,
    }),
  ];
  return (
    <>
      <ErrorBar message={error} />
      <AdminGrid items={c.documents} columns={columns} getRowId={(d) => d.id} loading={false} error={null} emptyText="No documents requested." label="Documents" />
    </>
  );
}


// ---------------------------------------------------------------- discrepancies
function DiscrepanciesTab({ c, canManage, onDialog }: { c: CaseOut; canManage: boolean; onDialog: (d: Dialogs) => void }) {
  const columns: TableColumnDefinition<Discrepancy>[] = [
    createTableColumn({
      columnId: "severity",
      renderHeaderCell: () => "Severity",
      renderCell: (d) => (
        <Badge appearance="filled" color={SEVERITY_COLORS[d.severity]}>
          {d.severity}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "description", renderHeaderCell: () => "Finding", renderCell: (d) => d.description }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (d) => d.status.replaceAll("_", " ") }),
    createTableColumn({ columnId: "due", renderHeaderCell: () => "Response due", renderCell: (d) => formatDate(d.response_due_on) }),
    createTableColumn({ columnId: "response", renderHeaderCell: () => "Candidate response", renderCell: (d) => d.candidate_response ?? "—" }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (d) =>
        canManage && d.status !== "resolved" && isActiveCase(c.status) ? (
          <Button size="small" onClick={() => onDialog({ kind: "resolve", discrepancy: d })}>
            Resolve
          </Button>
        ) : (
          (d.resolution_note ?? "")
        ),
    }),
  ];
  return (
    <AdminGrid items={c.discrepancies} columns={columns} getRowId={(d) => d.id} loading={false} error={null} emptyText="No discrepancies." label="Discrepancies" />
  );
}

function TimelineTab({ id }: { id: string }) {
  const styles = useStyles();
  const q = useQuery({ queryKey: bgvKeys.timeline(id), queryFn: ({ signal }) => bgvApi.timeline(id, signal) });
  if (q.isPending) return <Body1>Loading…</Body1>;
  if (q.isError) return <ErrorBar message={errorMessage(q.error)} />;
  return (
    <ol className={styles.timeline}>
      {q.data.map((e) => (
        <li key={e.id}>
          <Text weight="semibold">{e.kind.replaceAll("_", " ")}</Text>
          {e.to_status && <Caption1> → {e.to_status.replaceAll("_", " ")}</Caption1>}
          <br />
          <Caption1>
            {new Date(e.at).toLocaleString()} · {e.actor_kind}
          </Caption1>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- dialogs
function useAction(onDone: () => void, onClose: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onDone();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, run };
}

function Shell({ title, onClose, children, actions }: { title: string; onClose: () => void; children: React.ReactNode; actions: React.ReactNode }) {
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent>{children}</DialogContent>
          <DialogActions>{actions}</DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function RecordDialog({ check, onClose, onDone }: { check: BgvCheck; onClose: () => void; onDone: () => void }) {
  const admin = useAdminStyles();
  const styles = useStyles();
  const proposal = check.provider_proposal;
  const [result, setResult] = useState<CheckResult>(proposal?.result ?? "verified");
  const [accept, setAccept] = useState(Boolean(proposal));
  const [note, setNote] = useState("");
  const [verifier, setVerifier] = useState("");
  const [source, setSource] = useState("");
  const [verifiedOn, setVerifiedOn] = useState("");
  const [severity, setSeverity] = useState<Severity>("minor");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const { error, busy, run } = useAction(onDone, onClose);
  const submit = () =>
    run(async () => {
      for (const f of files) await bgvApi.uploadEvidence(check.id, f);
      await bgvApi.record(check.id, {
        result,
        note: note || null,
        verifier_name: verifier || null,
        source_contacted: source || null,
        verified_on: verifiedOn || null,
        accept_proposal: accept,
        discrepancy: result === "discrepancy" ? { severity, description } : null,
      });
    });
  return (
    <Shell
      title={`Record result — ${check.subject_label}`}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button appearance="primary" disabled={busy || (result === "discrepancy" && description.trim().length < 5)} onClick={() => void submit()}>
            Record
          </Button>
        </>
      }
    >
      <div className={admin.form}>
        {proposal && (
          <Card className={styles.proposal}>
            <Text weight="semibold">Provider proposal ({proposal.result.replaceAll("_", " ")})</Text>
            {proposal.note && <Body1>{proposal.note}</Body1>}
            <Caption1>
              {proposal.verifier_name ?? "—"} · {proposal.source_contacted ?? "—"} · {formatDate(proposal.verified_on)}
            </Caption1>
            <Checkbox label="Accept the provider proposal (fills empty fields)" checked={accept} onChange={(_, d) => setAccept(Boolean(d.checked))} />
          </Card>
        )}
        <Field label="Result" required>
          <RadioGroup value={result} onChange={(_, d) => setResult(d.value as CheckResult)}>
            <Radio value="verified" label="Verified" />
            <Radio value="discrepancy" label="Discrepancy" />
            <Radio value="unable_to_verify" label="Unable to verify" />
          </RadioGroup>
        </Field>
        <Field label="Note">
          <Textarea value={note} onChange={(_, d) => setNote(d.value)} />
        </Field>
        <Field label="Verifier name">
          <Input value={verifier} onChange={(_, d) => setVerifier(d.value)} />
        </Field>
        <Field label="Source contacted">
          <Input value={source} onChange={(_, d) => setSource(d.value)} />
        </Field>
        <Field label="Verified on">
          <Input type="date" value={verifiedOn} onChange={(_, d) => setVerifiedOn(d.value)} />
        </Field>
        <Field label="Evidence (PDF, JPG, PNG; up to 10 MB each)">
          <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        </Field>
        {result === "discrepancy" && (
          <>
            <Field label="Severity" required>
              <RadioGroup layout="horizontal" value={severity} onChange={(_, d) => setSeverity(d.value as Severity)}>
                <Radio value="minor" label="Minor" />
                <Radio value="major" label="Major" />
                <Radio value="critical" label="Critical" />
              </RadioGroup>
            </Field>
            <Field label="Discrepancy shown to the candidate" required hint="The candidate is asked to respond within the response window.">
              <Textarea value={description} onChange={(_, d) => setDescription(d.value)} />
            </Field>
          </>
        )}
        <ErrorBar message={error} />
      </div>
    </Shell>
  );
}

function ReasonDialog({
  title,
  label,
  minLength,
  confirm,
  onClose,
  onDone,
  action,
}: {
  title: string;
  label: string;
  minLength: number;
  confirm: string;
  onClose: () => void;
  onDone: () => void;
  action: (text: string) => Promise<unknown>;
}) {
  const admin = useAdminStyles();
  const [text, setText] = useState("");
  const { error, busy, run } = useAction(onDone, onClose);
  return (
    <Shell
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Back</Button>
          <Button appearance="primary" disabled={busy || text.trim().length < minLength} onClick={() => void run(() => action(text.trim()))}>
            {confirm}
          </Button>
        </>
      }
    >
      <div className={admin.form}>
        <Field label={label} required>
          <Textarea value={text} onChange={(_, d) => setText(d.value)} />
        </Field>
        <ErrorBar message={error} />
      </div>
    </Shell>
  );
}

function WaiveDialog({ check, onClose, onDone }: { check: BgvCheck; onClose: () => void; onDone: () => void }) {
  return (
    <ReasonDialog
      title={`Waive ${check.subject_label}`}
      label="Why is this check waived? (recorded and audited)"
      minLength={10}
      confirm="Waive"
      onClose={onClose}
      onDone={onDone}
      action={(t) => bgvApi.waive(check.id, t)}
    />
  );
}

function ResolveDialog({ discrepancy, onClose, onDone }: { discrepancy: Discrepancy; onClose: () => void; onDone: () => void }) {
  return (
    <ReasonDialog
      title="Resolve discrepancy"
      label="Resolution note"
      minLength={5}
      confirm="Resolve"
      onClose={onClose}
      onDone={onDone}
      action={(t) => bgvApi.resolve(discrepancy.id, t)}
    />
  );
}

function ReturnDialog({ caseId, doc, onClose, onDone }: { caseId: string; doc: DocumentRequest; onClose: () => void; onDone: () => void }) {
  return (
    <ReasonDialog
      title={`Return ${doc.label}`}
      label="What needs to change? (shown to the candidate)"
      minLength={3}
      confirm="Return"
      onClose={onClose}
      onDone={onDone}
      action={(t) => bgvApi.reviewDocument(caseId, doc.key, "return", t)}
    />
  );
}

function CancelDialog({ caseId, onClose, onDone }: { caseId: string; onClose: () => void; onDone: () => void }) {
  return (
    <ReasonDialog title="Cancel BGV case" label="Reason" minLength={3} confirm="Cancel case" onClose={onClose} onDone={onDone} action={(t) => bgvApi.cancel(caseId, t)} />
  );
}

export function AdjudicateDialog({ c, onClose, onDone }: { c: CaseOut; onClose: () => void; onDone: () => void }) {
  const admin = useAdminStyles();
  const guard = adjudicateGuard(c);
  const [outcome, setOutcome] = useState<"clear" | "failed">(guard.canClear ? "clear" : "failed");
  const [exceptions, setExceptions] = useState(false);
  const [reasons, setReasons] = useState("");
  const { error, busy, run } = useAction(onDone, onClose);
  const allowed = outcome === "clear" ? guard.canClear : guard.canFail;
  const invalid = reasonsError(reasons);
  return (
    <Shell
      title="Adjudicate"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Back</Button>
          <Button
            appearance="primary"
            disabled={busy || !allowed || invalid !== null}
            onClick={() => void run(() => bgvApi.adjudicate(c.id, { outcome, with_exceptions: outcome === "clear" && exceptions, reasons: reasons.trim() }))}
          >
            Record decision
          </Button>
        </>
      }
    >
      <div className={admin.form}>
        {guard.blocker && (
          <MessageBar intent="error">
            <MessageBarBody>{guard.blocker} Failed cannot be recorded until the candidate responds or the window lapses.</MessageBarBody>
          </MessageBar>
        )}
        <Field label="Outcome" required>
          <RadioGroup value={outcome} onChange={(_, d) => setOutcome(d.value as "clear" | "failed")}>
            <Radio value="clear" label="Clear" disabled={!guard.canClear} />
            <Radio value="failed" label="Failed" disabled={!(c.status === "under_review" || c.status === "discrepancy")} />
          </RadioGroup>
        </Field>
        {outcome === "clear" && <Checkbox label="Clear with exceptions" checked={exceptions} onChange={(_, d) => setExceptions(Boolean(d.checked))} />}
        <Field label="Reasons" required validationMessage={reasons && invalid ? invalid : undefined} hint={`At least ${MIN_REASONS} characters. Visible to internal users only.`}>
          <Textarea value={reasons} onChange={(_, d) => setReasons(d.value)} />
        </Field>
        <ErrorBar message={error} />
      </div>
    </Shell>
  );
}
