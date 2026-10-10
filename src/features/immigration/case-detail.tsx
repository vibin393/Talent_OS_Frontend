"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Checkbox,
  createTableColumn,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  Subtitle2,
  Tab,
  TabList,
  type TableColumnDefinition,
  Text,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular, ArrowSync20Regular, Send20Regular } from "@fluentui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AppLink } from "@/components/app-link";
import { AdminGrid, RowActions, type RowAction } from "@/features/admin/admin-grid";
import { ErrorBar, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { FileDrop } from "@/features/candidates/file-drop";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { immigrationApi } from "./api";
import {
  CASE_STATUS_COLORS,
  CASE_STATUS_LABELS,
  COLLECT_FROM_LABELS,
  countryName,
  fileError,
  formatDate,
  formatDateTime,
  isBackwardMove,
  PERMIT_STATUS_COLORS,
  REQUEST_STATUS_COLORS,
  REQUEST_STATUS_LABELS,
  STAGE_CATEGORY_LABELS,
  UPLOAD_ACCEPT,
} from "./logic";
import { OutcomeDialog, PermitDialog } from "./outcome-dialog";
import { StageStepper } from "./stage-stepper";
import type { CaseOut, DependantIn, DependantOut, DependantVisaStatus, PermitOut, Relationship, RequestOut, StageCategory, StageOut } from "./types";
import { DialogShell, MaskedNumber, ReasonDialog, useAction } from "./ui";
import {
  immigrationKeys,
  useCaseDependants,
  useCasePermits,
  useCaseRequests,
  useCaseTimeline,
  useCounsel,
  useImmigrationCase,
  useImmigrationPermissions,
  useRefreshCase,
} from "./use-immigration";

const useStyles = makeStyles({
  header: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, alignItems: "center", marginBottom: tokens.spacingVerticalM },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, marginLeft: "auto" },
  tabs: { marginBlock: tokens.spacingVerticalM },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, marginBottom: tokens.spacingVerticalL },
  card: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  columns: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: tokens.spacingHorizontalL },
  dateRow: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: tokens.spacingHorizontalS },
  dateInput: { minWidth: "160px" },
  inline: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: tokens.spacingHorizontalS },
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS, paddingBlock: tokens.spacingVerticalXS },
  muted: { color: tokens.colorNeutralForeground3 },
  warn: { color: tokens.colorPaletteMarigoldForeground2 },
  timeline: { listStyleType: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  event: { paddingLeft: tokens.spacingHorizontalM, borderLeft: `${tokens.strokeWidthThick} solid ${tokens.colorNeutralStroke2}` },
});

type Dialog =
  | { kind: "outcome" }
  | { kind: "permit" }
  | { kind: "withdraw" }
  | { kind: "move-back"; stage: StageOut }
  | { kind: "send"; ids: string[] }
  | { kind: "upload"; request: RequestOut }
  | { kind: "reject"; request: RequestOut }
  | { kind: "waive"; request: RequestOut }
  | { kind: "dependant"; dependant: DependantOut | null }
  | null;

const STATUS_DONE = new Set(["approved", "refused", "withdrawn"]);

/** `/immigration/cases/[id]`: header actions and tabs Overview, Checklist, Dependants, Permits, Timeline. */
export function ImmigrationCaseDetail({ id }: { id: string }) {
  const styles = useStyles();
  const { canRead, canManage } = useImmigrationPermissions();
  const [tab, setTab] = useState("overview");
  const [dialog, setDialog] = useState<Dialog>(null);
  const q = useImmigrationCase(id, canRead);
  const refresh = useRefreshCase(id);
  if (!canRead) return <NoAccess what="immigration cases" />;
  if (q.isPending) return <Body1>Loading…</Body1>;
  if (q.isError) return <ErrorBar title="Could not load the case." message={errorMessage(q.error)} />;
  const c = q.data;
  const can = (a: string) => canManage && c.allowed_actions.includes(a);
  const close = () => setDialog(null);
  return (
    <>
      <PageHeader
        title={`Immigration ${c.human_id}`}
        subtitle={`${c.candidate_name ?? "Person"} · ${c.visa_type_name}${c.visa_type_version_no != null ? ` (v${c.visa_type_version_no})` : ""} · ${countryName(c.country)}`}
      />
      <div className={styles.header}>
        <Badge size="large" appearance="tint" color={CASE_STATUS_COLORS[c.status]}>
          {CASE_STATUS_LABELS[c.status]}
        </Badge>
        {c.stage_label && (
          <Badge size="large" appearance="outline" color="brand">
            {c.stage_category ? `${STAGE_CATEGORY_LABELS[c.stage_category as StageCategory] ?? c.stage_category}: ` : ""}
            {c.stage_label}
          </Badge>
        )}
        {c.overdue && (
          <Badge size="large" appearance="filled" color="danger">
            Overdue
          </Badge>
        )}
        <div className={styles.actions}>
          {(can("approve") || can("refuse")) && (
            <Button appearance="primary" onClick={() => setDialog({ kind: "outcome" })}>
              Record decision
            </Button>
          )}
          {can("record_permit") && <Button onClick={() => setDialog({ kind: "permit" })}>Record permit</Button>}
          {can("withdraw") && <Button onClick={() => setDialog({ kind: "withdraw" })}>Withdraw</Button>}
        </div>
      </div>
      <MessageBar intent="info" layout="multiline">
        <MessageBarBody>{c.disclaimer}</MessageBarBody>
      </MessageBar>
      {c.outcome_note && (
        <Card className={styles.card}>
          <Text weight="semibold">Decision note ({formatDateTime(c.outcome_at)})</Text>
          <Body1>{c.outcome_note}</Body1>
        </Card>
      )}
      {c.withdraw_reason && (
        <Card className={styles.card}>
          <Text weight="semibold">Withdrawn</Text>
          <Body1>{c.withdraw_reason}</Body1>
        </Card>
      )}
      <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, d) => setTab(String(d.value))}>
        <Tab value="overview">Overview</Tab>
        <Tab value="checklist">Checklist</Tab>
        <Tab value="dependants">Dependants</Tab>
        <Tab value="permits">Permits</Tab>
        <Tab value="timeline">Timeline</Tab>
      </TabList>
      {tab === "overview" && <OverviewTab c={c} canMove={can("move_stage")} onDialog={setDialog} onChanged={refresh} />}
      {tab === "checklist" && <ChecklistTab c={c} onDialog={setDialog} />}
      {tab === "dependants" && <DependantsTab c={c} onDialog={setDialog} />}
      {tab === "permits" && <PermitsTab c={c} />}
      {tab === "timeline" && <TimelineTab c={c} />}
      {dialog?.kind === "outcome" && <OutcomeDialog c={c} onClose={close} onDone={refresh} />}
      {dialog?.kind === "permit" && <PermitDialog c={c} onClose={close} onDone={refresh} />}
      {dialog?.kind === "withdraw" && (
        <ReasonDialog
          title="Withdraw case"
          label="Reason"
          confirm="Withdraw"
          onClose={close}
          onDone={refresh}
          action={(r) => immigrationApi.withdraw(c.id, r)}
        />
      )}
      {dialog?.kind === "move-back" && (
        <ReasonDialog
          title={`Move back to ${dialog.stage.label}`}
          label="Why is the case moving back?"
          hint="Recorded on the timeline."
          confirm="Move back"
          onClose={close}
          onDone={refresh}
          action={(r) => immigrationApi.moveStage(c.id, dialog.stage.key, r)}
        />
      )}
      {dialog?.kind === "send" && <SendDialog c={c} ids={dialog.ids} onClose={close} />}
      {dialog?.kind === "upload" && <UploadDialog c={c} request={dialog.request} onClose={close} />}
      {dialog?.kind === "reject" && <RequestReasonDialog c={c} request={dialog.request} mode="reject" onClose={close} />}
      {dialog?.kind === "waive" && <RequestReasonDialog c={c} request={dialog.request} mode="waive" onClose={close} />}
      {dialog?.kind === "dependant" && <DependantDialog c={c} dependant={dialog.dependant} onClose={close} />}
    </>
  );
}

function useSubRefresh(c: CaseOut, sub: "requests" | "dependants" | "permits") {
  const refreshCase = useRefreshCase(c.id);
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: immigrationKeys.caseSub(c.id, sub) });
    void qc.invalidateQueries({ queryKey: immigrationKeys.caseSub(c.id, "timeline") });
    refreshCase();
  };
}

// ---------------------------------------------------------------- overview
function OverviewTab({
  c,
  canMove,
  onDialog,
  onChanged,
}: {
  c: CaseOut;
  canMove: boolean;
  onDialog: (d: Dialog) => void;
  onChanged: () => void;
}) {
  const styles = useStyles();
  const { canManage, canUnmask } = useImmigrationPermissions();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(isApiError(e) && e.code === "visa_stage_unknown" ? "That stage is not part of this case's visa type version." : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const move = (s: StageOut) => {
    if (isBackwardMove(c.stages, c.stage_key, s.key)) onDialog({ kind: "move-back", stage: s });
    else void run(() => immigrationApi.moveStage(c.id, s.key));
  };
  return (
    <div className={styles.section}>
      <Subtitle2 as="h2">Stages</Subtitle2>
      <StageStepper stages={c.stages} current={c.stage_key} onMove={canMove ? move : undefined} disabled={busy} />
      <ErrorBar message={error} />
      <div className={styles.columns}>
        <Card className={styles.card}>
          <Subtitle2 as="h2">Key dates</Subtitle2>
          {c.key_date_defs.length === 0 && <Caption1 className={styles.muted}>This visa type defines no key dates.</Caption1>}
          {c.key_date_defs.map((d) => (
            <KeyDateRow key={`${d.key}:${c.key_dates[d.key] ?? ""}`} c={c} defKey={d.key} label={d.label} canEdit={canManage && !STATUS_DONE.has(c.status)} onChanged={onChanged} />
          ))}
        </Card>
        <Card className={styles.card}>
          <Subtitle2 as="h2">Details</Subtitle2>
          <DetailsList c={c} canUnmask={canUnmask} />
          {canManage && <ReceiptEditor c={c} onChanged={onChanged} />}
          {canManage && <CounselEditor c={c} onChanged={onChanged} />}
        </Card>
      </div>
    </div>
  );
}

function DetailsList({ c, canUnmask }: { c: CaseOut; canUnmask: boolean }) {
  const admin = useAdminStyles();
  return (
    <dl className={admin.detailList}>
      <dt>Person</dt>
      <dd>
        <AppLink href={`/candidates/${c.candidate_id}`}>{c.candidate_name ?? "Open profile"}</AppLink>
      </dd>
      <dt>Owner</dt>
      <dd>{c.owner_name ?? "—"}</dd>
      <dt>Counsel</dt>
      <dd>{c.counsel_name ?? "—"}</dd>
      <dt>Receipt number</dt>
      <dd>
        <MaskedNumber last4={c.receipt_number_last4} label="Receipt number" canUnmask={canUnmask} unmask={() => immigrationApi.unmaskReceipt(c.id)} />
      </dd>
      <dt>Sponsoring entity</dt>
      <dd>
        {c.sponsoring_legal_entity_id ? <AppLink href={`/settings/legal-entities/${c.sponsoring_legal_entity_id}`}>Open legal entity</AppLink> : "—"}
      </dd>
      <dt>Placement</dt>
      <dd>{c.placement_id ? <AppLink href={`/placements/${c.placement_id}`}>Open placement</AppLink> : "—"}</dd>
      <dt>Demand</dt>
      <dd>{c.demand_id ? <AppLink href={`/demands/${c.demand_id}`}>Open demand</AppLink> : "—"}</dd>
      <dt>Project</dt>
      <dd>{c.project_id ?? "—"}</dd>
      <dt>Opened</dt>
      <dd>{formatDate(c.created_at)}</dd>
    </dl>
  );
}

function KeyDateRow({
  c,
  defKey,
  label,
  canEdit,
  onChanged,
}: {
  c: CaseOut;
  defKey: string;
  label: string;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const styles = useStyles();
  const saved = c.key_dates[defKey] ?? "";
  const [value, setValue] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (next: string | null) => {
    setBusy(true);
    setError(null);
    try {
      await immigrationApi.setKeyDate(c.id, defKey, next);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  if (!canEdit) {
    return (
      <div className={styles.dateRow}>
        <Text>{label}:</Text>
        <Text weight="semibold">{formatDate(saved || null)}</Text>
      </div>
    );
  }
  return (
    <div className={styles.dateRow}>
      <Field label={label} validationMessage={error ?? undefined}>
        <Input className={styles.dateInput} type="date" value={value} onChange={(_, d) => setValue(d.value)} />
      </Field>
      <Button disabled={busy || value === saved || !value} onClick={() => void save(value)}>
        Save
      </Button>
      {saved && (
        <Button
          appearance="subtle"
          disabled={busy}
          onClick={() => {
            setValue("");
            void save(null);
          }}
        >
          Clear
        </Button>
      )}
    </div>
  );
}

function ReceiptEditor({ c, onChanged }: { c: CaseOut; onChanged: () => void }) {
  const styles = useStyles();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await immigrationApi.setReceipt(c.id, value.trim());
      setValue("");
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.inline}>
      <Field
        label={c.receipt_number_last4 ? "Replace receipt number" : "Receipt number"}
        hint="Stored encrypted; only the last 4 characters are shown."
        validationMessage={error ?? undefined}
      >
        <Input value={value} maxLength={40} autoComplete="off" onChange={(_, d) => setValue(d.value)} />
      </Field>
      <Button disabled={busy || value.trim().length < 3} onClick={() => void save()}>
        Save receipt
      </Button>
    </div>
  );
}

const NONE = "__none__";

function CounselEditor({ c, onChanged }: { c: CaseOut; onChanged: () => void }) {
  const styles = useStyles();
  const counsel = useCounsel(false);
  const [error, setError] = useState<string | null>(null);
  const change = async (id: string | null) => {
    setError(null);
    try {
      await immigrationApi.patchCase(c.id, { counsel_id: id, lock_version: c.lock_version });
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  return (
    <div className={styles.inline}>
      <Field label="Change counsel" validationMessage={error ?? undefined}>
        <Dropdown
          value={c.counsel_name ?? "None"}
          selectedOptions={[c.counsel_id ?? NONE]}
          onOptionSelect={(_, d) => void change(d.optionValue === NONE ? null : String(d.optionValue))}
        >
          <Option value={NONE}>None</Option>
          {(counsel.data ?? []).map((x) => (
            <Option key={x.id} value={x.id} text={x.name}>
              {x.name}
              {x.firm ? ` · ${x.firm}` : ""}
            </Option>
          ))}
        </Dropdown>
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------- checklist
function ChecklistTab({ c, onDialog }: { c: CaseOut; onDialog: (d: Dialog) => void }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const { canManage } = useImmigrationPermissions();
  const list = useCaseRequests(c.id);
  const refresh = useSubRefresh(c, "requests");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const open = !STATUS_DONE.has(c.status);
  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await fn());
      refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const items = list.data ?? [];
  const sendable = items.filter((r) => r.status === "requested" || r.status === "rejected");
  const actionsFor = (r: RequestOut): RowAction[] => {
    if (!canManage || !open) return [];
    const a: RowAction[] = [];
    if (r.status !== "verified" && r.status !== "waived") a.push({ label: "Upload", onClick: () => onDialog({ kind: "upload", request: r }) });
    if (r.status === "uploaded") {
      a.push({
        label: "Verify",
        onClick: () =>
          void run(async () => {
            const out = await immigrationApi.verifyRequest(r.id);
            return out.warnings.length ? `Verified with warnings: ${out.warnings.join("; ")}` : `${r.label} verified.`;
          }),
      });
      a.push({ label: "Reject", onClick: () => onDialog({ kind: "reject", request: r }) });
    }
    if (r.status !== "verified" && r.status !== "waived") a.push({ label: "Waive", onClick: () => onDialog({ kind: "waive", request: r }) });
    return a;
  };
  const columns: TableColumnDefinition<RequestOut>[] = [
    ...(canManage && open
      ? [
          createTableColumn<RequestOut>({
            columnId: "select",
            renderHeaderCell: () => "Send",
            renderCell: (r) =>
              r.status === "requested" || r.status === "rejected" ? (
                <Checkbox aria-label={`Select ${r.label}`} checked={selected.has(r.id)} onChange={(_, d) => toggle(r.id, Boolean(d.checked))} />
              ) : null,
          }),
        ]
      : []),
    createTableColumn<RequestOut>({
      columnId: "item",
      renderHeaderCell: () => "Document",
      renderCell: (r) => (
        <span className={styles.stack}>
          <Text weight="semibold">
            {r.label}
            {r.mandatory ? "" : " (optional)"}
          </Text>
          {r.dependant_name && <Caption1 className={styles.muted}>For {r.dependant_name}</Caption1>}
          {r.rejection_reason && r.status === "rejected" && <Caption1>Rejected: {r.rejection_reason}</Caption1>}
          {r.warnings.map((w) => (
            <Caption1 key={w} className={styles.warn}>
              {w}
            </Caption1>
          ))}
        </span>
      ),
    }),
    createTableColumn<RequestOut>({ columnId: "from", renderHeaderCell: () => "From", renderCell: (r) => COLLECT_FROM_LABELS[r.collect_from] ?? r.collect_from }),
    createTableColumn<RequestOut>({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => (
        <Badge appearance="tint" color={REQUEST_STATUS_COLORS[r.status]}>
          {REQUEST_STATUS_LABELS[r.status]}
        </Badge>
      ),
    }),
    createTableColumn<RequestOut>({ columnId: "due", renderHeaderCell: () => "Due", renderCell: (r) => formatDate(r.due_date) }),
    createTableColumn<RequestOut>({
      columnId: "actions",
      renderHeaderCell: () => <span className={admin.muted}>Actions</span>,
      renderCell: (r) => <RowActions label={r.label} actions={actionsFor(r)} />,
    }),
  ];
  const ids = [...selected].filter((id) => sendable.some((r) => r.id === id));
  return (
    <div className={styles.section}>
      {canManage && open && (
        <div className={admin.toolbar}>
          <Button
            icon={<ArrowSync20Regular />}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const out = await immigrationApi.generateChecklist(c.id);
                return `Checklist generated: ${out.length} item(s).`;
              })
            }
          >
            Generate checklist
          </Button>
          <Button appearance="primary" icon={<Send20Regular />} disabled={busy || ids.length === 0} onClick={() => onDialog({ kind: "send", ids })}>
            Send requests ({ids.length})
          </Button>
          {sendable.length > 0 && (
            <Button appearance="subtle" onClick={() => setSelected(new Set(sendable.map((r) => r.id)))}>
              Select all open
            </Button>
          )}
        </div>
      )}
      {notice && (
        <MessageBar intent="success" role="status">
          <MessageBarBody>{notice}</MessageBarBody>
        </MessageBar>
      )}
      <ErrorBar message={error} />
      <AdminGrid
        items={list.data}
        columns={columns}
        getRowId={(r) => r.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No document requests yet. Generate the checklist from the visa type."
        label="Document requests"
      />
    </div>
  );
}

function SendDialog({ c, ids, onClose }: { c: CaseOut; ids: string[]; onClose: () => void }) {
  const admin = useAdminStyles();
  const refresh = useSubRefresh(c, "requests");
  const [due, setDue] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const { error, busy, run } = useAction(refresh, () => undefined);
  if (result) {
    return (
      <DialogShell title="Requests sent" onClose={onClose} actions={<Button appearance="primary" onClick={onClose}>Done</Button>}>
        <Body1 role="status">{result}</Body1>
      </DialogShell>
    );
  }
  return (
    <DialogShell
      title={`Send ${ids.length} request(s)`}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            appearance="primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const out = await immigrationApi.sendRequests(c.id, { request_ids: ids, due_date: due || null });
                setResult(
                  `Worker notified: ${out.notified_worker}. Secure links sent — worker: ${out.worker_links}, counsel: ${out.counsel_links}. Internal items: ${out.internal}.`,
                );
              })
            }
          >
            Send
          </Button>
        </>
      }
    >
      <div className={admin.form}>
        <Body1>Workers are notified in My Work; counsel and people without portal access receive a Secure Link.</Body1>
        <Field label="Due date">
          <Input type="date" value={due} onChange={(_, d) => setDue(d.value)} />
        </Field>
        <ErrorBar message={error} />
      </div>
    </DialogShell>
  );
}

function UploadDialog({ c, request, onClose }: { c: CaseOut; request: RequestOut; onClose: () => void }) {
  const admin = useAdminStyles();
  const refresh = useSubRefresh(c, "requests");
  const [file, setFile] = useState<File | null>(null);
  const [local, setLocal] = useState<string | null>(null);
  const { error, busy, run } = useAction(refresh, onClose);
  return (
    <DialogShell
      title={`Upload ${request.label}`}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button appearance="primary" disabled={busy || !file} onClick={() => file && void run(() => immigrationApi.uploadRequest(request.id, file))}>
            Upload
          </Button>
        </>
      }
    >
      <div className={admin.form}>
        <FileDrop
          accept={UPLOAD_ACCEPT}
          title={file ? file.name : "Drop the document here"}
          hint="PDF, JPG or PNG, up to 10 MB."
          disabled={busy}
          onFiles={([f]) => {
            const err = f ? fileError(f) : null;
            setLocal(err);
            setFile(err ? null : (f ?? null));
          }}
        />
        <ErrorBar message={local ?? error} />
      </div>
    </DialogShell>
  );
}

function RequestReasonDialog({ c, request, mode, onClose }: { c: CaseOut; request: RequestOut; mode: "reject" | "waive"; onClose: () => void }) {
  const refresh = useSubRefresh(c, "requests");
  return mode === "reject" ? (
    <ReasonDialog
      title={`Reject ${request.label}`}
      label="What is wrong? (shown to the person uploading)"
      confirm="Reject"
      onClose={onClose}
      onDone={refresh}
      action={(r) => immigrationApi.rejectRequest(request.id, r)}
    />
  ) : (
    <ReasonDialog
      title={`Waive ${request.label}`}
      label="Why is this document not needed? (recorded and audited)"
      confirm="Waive"
      onClose={onClose}
      onDone={refresh}
      action={(r) => immigrationApi.waiveRequest(request.id, r)}
    />
  );
}

// ---------------------------------------------------------------- dependants
const RELATIONSHIPS: Relationship[] = ["spouse", "child", "parent", "other"];
const DEP_STATUSES: DependantVisaStatus[] = ["not_started", "in_progress", "approved", "refused", "withdrawn"];
const human = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replaceAll("_", " ");

function DependantsTab({ c, onDialog }: { c: CaseOut; onDialog: (d: Dialog) => void }) {
  const admin = useAdminStyles();
  const { canManage, canUnmask } = useImmigrationPermissions();
  const list = useCaseDependants(c.id);
  const refresh = useSubRefresh(c, "dependants");
  const [error, setError] = useState<string | null>(null);
  const remove = async (d: DependantOut) => {
    setError(null);
    try {
      await immigrationApi.deleteDependant(c.id, d.id);
      refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const columns: TableColumnDefinition<DependantOut>[] = [
    createTableColumn({ columnId: "name", renderHeaderCell: () => "Name", renderCell: (d) => d.name }),
    createTableColumn({ columnId: "rel", renderHeaderCell: () => "Relationship", renderCell: (d) => human(d.relationship) }),
    createTableColumn({ columnId: "nat", renderHeaderCell: () => "Nationality", renderCell: (d) => (d.nationality ? countryName(d.nationality) : "—") }),
    createTableColumn({
      columnId: "passport",
      renderHeaderCell: () => "Passport",
      renderCell: (d) => (
        <MaskedNumber
          last4={d.passport_number_last4}
          label="Passport number"
          canUnmask={canUnmask}
          unmask={() => immigrationApi.unmaskPassport(c.id, d.id)}
        />
      ),
    }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Visa status", renderCell: (d) => human(d.visa_status) }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => <span className={admin.muted}>Actions</span>,
      renderCell: (d) => (
        <RowActions
          label={d.name}
          actions={
            canManage
              ? [
                  { label: "Edit", onClick: () => onDialog({ kind: "dependant", dependant: d }) },
                  { label: "Remove", onClick: () => void remove(d) },
                ]
              : []
          }
        />
      ),
    }),
  ];
  return (
    <>
      {canManage && (
        <div className={admin.toolbar}>
          <Button icon={<Add20Regular />} onClick={() => onDialog({ kind: "dependant", dependant: null })}>
            Add dependant
          </Button>
        </div>
      )}
      <ErrorBar message={error} />
      <AdminGrid
        items={list.data}
        columns={columns}
        getRowId={(d) => d.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No dependants on this case."
        label="Dependants"
      />
    </>
  );
}

function DependantDialog({ c, dependant, onClose }: { c: CaseOut; dependant: DependantOut | null; onClose: () => void }) {
  const admin = useAdminStyles();
  const refresh = useSubRefresh(c, "dependants");
  const [name, setName] = useState(dependant?.name ?? "");
  const [relationship, setRelationship] = useState<Relationship>((dependant?.relationship as Relationship) ?? "spouse");
  const [nationality, setNationality] = useState(dependant?.nationality ?? "");
  const [passport, setPassport] = useState("");
  const [status, setStatus] = useState<DependantVisaStatus>((dependant?.visa_status as DependantVisaStatus) ?? "not_started");
  const [notes, setNotes] = useState(dependant?.notes ?? "");
  const { error, busy, run } = useAction(refresh, onClose);
  const natInvalid = nationality !== "" && !/^[A-Z]{2}$/.test(nationality);
  const passInvalid = passport !== "" && (passport.trim().length < 4 || passport.trim().length > 30);
  const submit = () => {
    const body: DependantIn = {
      name: name.trim(),
      relationship,
      nationality: nationality || null,
      visa_status: status,
      notes: notes.trim() || null,
      ...(passport.trim() ? { passport_number: passport.trim() } : {}),
    };
    void run(() => (dependant ? immigrationApi.patchDependant(c.id, dependant.id, body) : immigrationApi.addDependant(c.id, body)));
  };
  return (
    <DialogShell
      title={dependant ? `Edit ${dependant.name}` : "Add dependant"}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button appearance="primary" disabled={busy || !name.trim() || natInvalid || passInvalid} onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      <div className={admin.form}>
        <Field label="Name" required>
          <Input value={name} maxLength={200} onChange={(_, d) => setName(d.value)} />
        </Field>
        <Field label="Relationship" required>
          <Dropdown value={human(relationship)} selectedOptions={[relationship]} onOptionSelect={(_, d) => setRelationship(d.optionValue as Relationship)}>
            {RELATIONSHIPS.map((r) => (
              <Option key={r} value={r}>
                {human(r)}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Nationality" hint="ISO country code, e.g. IN" validationMessage={natInvalid ? "Use a 2-letter country code." : undefined}>
          <Input value={nationality} maxLength={2} onChange={(_, d) => setNationality(d.value.toUpperCase())} />
        </Field>
        <Field
          label={dependant?.passport_number_last4 ? "Replace passport number" : "Passport number"}
          hint="Stored encrypted; shown masked afterwards."
          validationMessage={passInvalid ? "4 to 30 characters." : undefined}
        >
          <Input value={passport} maxLength={30} autoComplete="off" onChange={(_, d) => setPassport(d.value)} />
        </Field>
        <Field label="Visa status">
          <Dropdown value={human(status)} selectedOptions={[status]} onOptionSelect={(_, d) => setStatus(d.optionValue as DependantVisaStatus)}>
            {DEP_STATUSES.map((s) => (
              <Option key={s} value={s}>
                {human(s)}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Notes">
          <Textarea value={notes} maxLength={4000} onChange={(_, d) => setNotes(d.value)} />
        </Field>
        <ErrorBar message={error} />
      </div>
    </DialogShell>
  );
}

// ---------------------------------------------------------------- permits
function PermitsTab({ c }: { c: CaseOut }) {
  const styles = useStyles();
  const { canUnmask } = useImmigrationPermissions();
  const list = useCasePermits(c.id);
  const labelFor = (key: string) => c.expiry_fields.find((f) => f.key === key)?.label ?? key;
  const columns: TableColumnDefinition<PermitOut>[] = [
    createTableColumn({ columnId: "type", renderHeaderCell: () => "Permit", renderCell: (p) => p.permit_type }),
    createTableColumn({
      columnId: "number",
      renderHeaderCell: () => "Number",
      renderCell: (p) => (
        <MaskedNumber last4={p.number_last4} label="Permit number" canUnmask={canUnmask} unmask={() => immigrationApi.unmaskPermit(p.id)} />
      ),
    }),
    createTableColumn({ columnId: "from", renderHeaderCell: () => "Valid from", renderCell: (p) => formatDate(p.valid_from) }),
    createTableColumn({ columnId: "to", renderHeaderCell: () => "Valid to", renderCell: (p) => formatDate(p.valid_to) }),
    createTableColumn({
      columnId: "other",
      renderHeaderCell: () => "Other expiries",
      renderCell: (p) => {
        const entries = Object.entries(p.expiry_values);
        if (!entries.length) return "—";
        return (
          <span className={styles.stack}>
            {entries.map(([k, v]) => (
              <Caption1 key={k}>
                {labelFor(k)}: {formatDate(v)}
              </Caption1>
            ))}
          </span>
        );
      },
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (p) => (
        <Badge appearance="tint" color={PERMIT_STATUS_COLORS[p.status] ?? "informative"}>
          {human(p.status)}
        </Badge>
      ),
    }),
  ];
  return (
    <AdminGrid
      items={list.data}
      columns={columns}
      getRowId={(p) => p.id}
      loading={list.isPending}
      error={list.error}
      emptyText="No permit recorded yet. Record the decision to add one."
      label="Permits"
    />
  );
}

// ---------------------------------------------------------------- timeline
function eventTitle(e: { kind: string; from_stage: string | null; to_stage: string | null }, c: CaseOut): string {
  const label = (k: string | null) => (k ? (c.stages.find((s) => s.key === k)?.label ?? k) : "—");
  if (e.to_stage) return `${human(e.kind)}: ${label(e.from_stage)} → ${label(e.to_stage)}`;
  return human(e.kind);
}

function TimelineTab({ c }: { c: CaseOut }) {
  const styles = useStyles();
  const q = useCaseTimeline(c.id);
  if (q.isPending) return <Body1>Loading…</Body1>;
  if (q.isError) return <ErrorBar message={errorMessage(q.error)} />;
  if (q.data.length === 0) return <Body1 className={styles.muted}>No events yet.</Body1>;
  return (
    <ol className={styles.timeline}>
      {q.data.map((e) => {
        const actor = typeof e.actor.name === "string" ? e.actor.name : typeof e.actor.kind === "string" ? e.actor.kind : "System";
        const reason = typeof e.payload.reason === "string" ? e.payload.reason : null;
        return (
          <li key={e.id} className={styles.event}>
            <Text weight="semibold">{eventTitle(e, c)}</Text>
            {reason && <Body1>{reason}</Body1>}
            <br />
            <Caption1 className={styles.muted}>
              {formatDateTime(e.at)} · {actor}
            </Caption1>
          </li>
        );
      })}
    </ol>
  );
}
