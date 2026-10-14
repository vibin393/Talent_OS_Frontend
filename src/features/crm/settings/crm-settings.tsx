"use client";

import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  SpinButton,
  Spinner,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { crmApi, crmKeys } from "../api";
import { REASON_KIND_LABELS, STAGE_LABELS, STAGES } from "../format";
import type { LeadSourceOut, ReasonCodeOut, ReasonKind } from "../types";
import { useCrmSettings, useLeadSources, useReasonCodes } from "../use-leads";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalL, marginBottom: tokens.spacingVerticalL, maxWidth: "860px" },
  probs: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: tokens.spacingHorizontalM },
  add: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "flex-end", marginTop: tokens.spacingVerticalM },
  actions: { marginTop: tokens.spacingVerticalM },
});

const CODE_RE = /^[a-z0-9_]{1,40}$/;

function ProbabilityCard({ canManage }: { canManage: boolean }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const settings = useCrmSettings();
  const [draft, setDraft] = useState<Record<string, number> | null>(null);
  const save = useMutation({
    mutationFn: (p: Record<string, number>) => crmApi.updateSettings({ stage_probabilities: p }),
    onSuccess: (s) => {
      qc.setQueryData(crmKeys.settings, s);
      setDraft(null);
      toast.success("Stage probabilities saved");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (settings.error) return <ErrorBar message={errorMessage(settings.error)} />;
  if (!settings.data) return <GridSkeleton rows={2} />;
  const values = draft ?? settings.data.stage_probabilities;
  return (
    <Card className={styles.card}>
      <CardHeader header={<Subtitle2 as="h2">Stage probabilities</Subtitle2>} description="Default win probability (%) for each stage. Overrides on an opportunity are kept." />
      <div className={styles.probs}>
        {STAGES.map((s) => (
          <Field key={s} label={STAGE_LABELS[s]}>
            <SpinButton
              min={0}
              max={100}
              value={values[s] ?? 0}
              disabled={!canManage || s === "won" || s === "lost"}
              onChange={(_, d) => {
                const n = d.value ?? Number(d.displayValue);
                if (Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 100) setDraft({ ...values, [s]: n as number });
              }}
            />
          </Field>
        ))}
      </div>
      {canManage && draft && (
        <div className={styles.actions}>
          <Button appearance="primary" disabled={save.isPending} icon={save.isPending ? <Spinner size="tiny" /> : undefined} onClick={() => save.mutate(draft)}>
            Save
          </Button>{" "}
          <Button onClick={() => setDraft(null)}>Discard</Button>
        </div>
      )}
    </Card>
  );
}

type CodeRow = { id: string; code: string; label: string; archived_at: string | null; kind?: ReasonKind };

function CodesTable({
  rows,
  canManage,
  showKind,
  onRename,
  onArchive,
}: {
  rows: CodeRow[];
  canManage: boolean;
  showKind?: boolean;
  onRename: (id: string, label: string) => Promise<unknown>;
  onArchive: (id: string, archived: boolean) => Promise<unknown>;
}) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  return (
    <Table size="small">
      <TableHeader>
        <TableRow>
          {showKind && <TableHeaderCell>Kind</TableHeaderCell>}
          <TableHeaderCell>Code</TableHeaderCell>
          <TableHeaderCell>Label</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          {canManage && <TableHeaderCell aria-label="Actions" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const edit = edits[r.id];
          return (
            <TableRow key={r.id}>
              {showKind && <TableCell>{r.kind ? REASON_KIND_LABELS[r.kind] : ""}</TableCell>}
              <TableCell>{r.code}</TableCell>
              <TableCell>
                {canManage ? (
                  <Input
                    aria-label={`Label for ${r.code}`}
                    style={{ width: "100%", minWidth: 0 }}
                    value={edit ?? r.label}
                    maxLength={200}
                    onChange={(_, d) => setEdits((e) => ({ ...e, [r.id]: d.value }))}
                    onBlur={() => {
                      if (edit !== undefined && edit.trim() && edit.trim() !== r.label)
                        void onRename(r.id, edit.trim()).then(() =>
                          setEdits((e) => {
                            const next = { ...e };
                            delete next[r.id];
                            return next;
                          }),
                        );
                    }}
                  />
                ) : (
                  r.label
                )}
              </TableCell>
              <TableCell>
                {r.archived_at ? (
                  <Badge appearance="tint" color="subtle">
                    Archived
                  </Badge>
                ) : (
                  <Badge appearance="tint" color="success">
                    Active
                  </Badge>
                )}
              </TableCell>
              {canManage && (
                <TableCell>
                  <Button size="small" onClick={() => void onArchive(r.id, !r.archived_at)}>
                    {r.archived_at ? "Restore" : "Archive"}
                  </Button>
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ReasonCodesCard({ canManage }: { canManage: boolean }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const codes = useReasonCodes();
  const [kind, setKind] = useState<ReasonKind>("opportunity_lost");
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: crmKeys.reasonCodesAll });
  const run = (p: Promise<unknown>) => p.then(refresh).catch((e) => toast.error(errorMessage(e)));
  return (
    <Card className={styles.card}>
      <CardHeader header={<Subtitle2 as="h2">Reason codes</Subtitle2>} description="Reasons for disqualifying leads, losing and reopening opportunities." />
      {codes.data ? (
        <CodesTable
          rows={codes.data as ReasonCodeOut[]}
          canManage={canManage}
          showKind
          onRename={(id, l) => run(crmApi.updateReasonCode(id, { label: l }))}
          onArchive={(id, archived) => run(crmApi.updateReasonCode(id, { archived }))}
        />
      ) : (
        <GridSkeleton rows={3} />
      )}
      {canManage && (
        <div className={styles.add}>
          <Field label="Kind">
            <Dropdown value={REASON_KIND_LABELS[kind]} selectedOptions={[kind]} onOptionSelect={(_, d) => d.optionValue && setKind(d.optionValue as ReasonKind)}>
              {(Object.keys(REASON_KIND_LABELS) as ReasonKind[]).map((k) => (
                <Option key={k} value={k}>
                  {REASON_KIND_LABELS[k]}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <Field label="Code" hint="a-z, 0-9, _">
            <Input value={code} maxLength={40} onChange={(_, d) => setCode(d.value.toLowerCase())} />
          </Field>
          <Field label="Label">
            <Input value={label} maxLength={200} onChange={(_, d) => setLabel(d.value)} />
          </Field>
          <Button
            icon={<Add20Regular />}
            disabled={!CODE_RE.test(code) || !label.trim()}
            onClick={() =>
              run(crmApi.createReasonCode({ kind, code, label: label.trim() })).then(() => {
                setCode("");
                setLabel("");
              })
            }
          >
            Add reason
          </Button>
        </div>
      )}
    </Card>
  );
}

function LeadSourcesCard({ canManage }: { canManage: boolean }) {
  const styles = useStyles();
  const toast = useAppToast();
  const qc = useQueryClient();
  const sources = useLeadSources();
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: crmKeys.leadSources });
  const run = (p: Promise<unknown>) => p.then(refresh).catch((e) => toast.error(errorMessage(e)));
  return (
    <Card className={styles.card}>
      <CardHeader header={<Subtitle2 as="h2">Lead sources</Subtitle2>} />
      {sources.data ? (
        <CodesTable
          rows={sources.data as LeadSourceOut[]}
          canManage={canManage}
          onRename={(id, l) => run(crmApi.updateLeadSource(id, { label: l }))}
          onArchive={(id, archived) => run(crmApi.updateLeadSource(id, { archived }))}
        />
      ) : (
        <GridSkeleton rows={3} />
      )}
      {canManage && (
        <div className={styles.add}>
          <Field label="Code" hint="a-z, 0-9, _">
            <Input value={code} maxLength={40} onChange={(_, d) => setCode(d.value.toLowerCase())} />
          </Field>
          <Field label="Label">
            <Input value={label} maxLength={200} onChange={(_, d) => setLabel(d.value)} />
          </Field>
          <Button
            icon={<Add20Regular />}
            disabled={!CODE_RE.test(code) || !label.trim()}
            onClick={() =>
              run(crmApi.createLeadSource({ code, label: label.trim() })).then(() => {
                setCode("");
                setLabel("");
              })
            }
          >
            Add source
          </Button>
        </div>
      )}
    </Card>
  );
}

/** `/settings/crm`: stage probabilities, reason codes and lead sources. */
export function CrmSettings() {
  const canReadLeads = usePermission("lead:read");
  const canManage = usePermission("settings:manage");
  if (!canReadLeads && !canManage) return <NoAccess what="sales settings" />;
  return (
    <>
      <PageHeader title="Sales settings" subtitle="Pipeline probabilities and the codes used by leads and opportunities." />
      <ProbabilityCard canManage={canManage} />
      <ReasonCodesCard canManage={canManage} />
      <LeadSourcesCard canManage={canManage} />
    </>
  );
}

