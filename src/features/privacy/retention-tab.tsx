"use client";

import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  createTableColumn,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  SpinButton,
  Spinner,
  Subtitle2,
  Switch,
  type TableColumnDefinition,
  tokens,
} from "@fluentui/react-components";
import { Eye20Regular, Play20Regular, Dismiss20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { ErrorBar, formatDateTime, GridSkeleton, PagingBar } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import type { RetentionItemOut, RetentionPolicyOut, RetentionRunOut } from "@/lib/api/types";
import { privacyApi, privacyErrorMessage, privacyKeys } from "./api";
import { TypedConfirmDialog } from "./dialogs";
import { RetentionClassesSection } from "./retention-classes/retention-classes";
import { CopilotRetentionRow } from "./copilot-retention-row";
import { humanize, RETENTION_CONFIRM_WORD, RETENTION_ITEM_LABELS, RETENTION_RUN_COLORS } from "./format";

const PAGE_SIZE = 20;
const MIN_MONTHS = 6;
const MAX_MONTHS = 120;

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, maxWidth: "1080px" },
  card: { padding: tokens.spacingHorizontalL, gap: tokens.spacingVerticalM },
  row: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXL, alignItems: "flex-end" },
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS },
});

function clampInt(v: number | null | undefined, min: number, max: number, fallback: number): number {
  if (v === null || v === undefined || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

/** Retention tab: policy form -> Preview -> paged results -> Execute (typed ANONYMIZE); run history. */
export function RetentionTab() {
  const styles = useStyles();
  const canManage = usePermission("retention:manage");
  const policy = useQuery({ queryKey: privacyKeys.retentionPolicy, queryFn: ({ signal }) => privacyApi.retentionPolicy(signal), enabled: canManage });
  const [runId, setRunId] = useState<string | null>(null);
  if (!canManage) {
    return <Body1>You need the retention:manage permission to manage the retention policy.</Body1>;
  }
  return (
    <div className={styles.root}>
      {policy.isPending ? (
        <GridSkeleton rows={3} />
      ) : policy.isError ? (
        <ErrorBar message={privacyErrorMessage(policy.error)} />
      ) : (
        <PolicyCard key={JSON.stringify(policy.data)} policy={policy.data} onPreview={setRunId} />
      )}
      <RetentionClassesSection />
      <CopilotRetentionRow />
      {runId && <RunCard runId={runId} onClose={() => setRunId(null)} />}
      <RunHistory onOpen={setRunId} />
    </div>
  );
}

function PolicyCard({ policy, onPreview }: { policy: RetentionPolicyOut; onPreview: (id: string) => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(policy.candidate_inactive_months !== null);
  const [months, setMonths] = useState(policy.candidate_inactive_months ?? 24);
  const [autoExecute, setAutoExecute] = useState(policy.auto_execute);
  const [auditYears, setAuditYears] = useState(policy.audit_retention_years);
  const [error, setError] = useState<string | null>(null);
  const body = {
    candidate_inactive_months: enabled ? months : null,
    auto_execute: enabled && autoExecute,
    audit_retention_years: auditYears,
  };
  const dirty =
    body.candidate_inactive_months !== policy.candidate_inactive_months ||
    body.auto_execute !== policy.auto_execute ||
    body.audit_retention_years !== policy.audit_retention_years;
  const save = useMutation({
    mutationFn: () => privacyApi.setRetentionPolicy(body),
    onSuccess: (out) => {
      queryClient.setQueryData(privacyKeys.retentionPolicy, out);
      toast.success("Retention policy saved");
    },
    onError: (e) => setError(privacyErrorMessage(e)),
  });
  const preview = useMutation({
    mutationFn: () => privacyApi.previewRetention(enabled ? months : null),
    onSuccess: async (run) => {
      await queryClient.invalidateQueries({ queryKey: privacyKeys.retentionRuns });
      onPreview(run.id);
    },
    onError: (e) => setError(privacyErrorMessage(e)),
  });
  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h2">Retention policy</Subtitle2>}
        description={
          <Caption1>
            Anonymize candidates with no activity for a number of months. Candidates under a legal hold, with an open
            application or an open request are never included.
          </Caption1>
        }
      />
      <ErrorBar message={error} />
      <Switch label="Anonymize inactive candidates" checked={enabled} onChange={(_, d) => setEnabled(d.checked)} />
      <div className={styles.row}>
        <Field label="Inactive for (months)" hint={`${MIN_MONTHS}–${MAX_MONTHS} months`}>
          <SpinButton
            value={months}
            min={MIN_MONTHS}
            max={MAX_MONTHS}
            disabled={!enabled}
            onChange={(_, d) => setMonths(clampInt(d.value ?? Number(d.displayValue), MIN_MONTHS, MAX_MONTHS, months))}
          />
        </Field>
        <Field label="Keep audit log for (years)" hint="1–10 years">
          <SpinButton
            value={auditYears}
            min={1}
            max={10}
            onChange={(_, d) => setAuditYears(clampInt(d.value ?? Number(d.displayValue), 1, 10, auditYears))}
          />
        </Field>
      </div>
      <Switch
        label="Run automatically: the monthly preview is executed after 7 days unless an admin cancels it"
        checked={enabled && autoExecute}
        disabled={!enabled}
        onChange={(_, d) => setAutoExecute(d.checked)}
      />
      <div className={styles.actions}>
        <Button
          appearance="primary"
          disabled={!dirty || save.isPending}
          icon={save.isPending ? <Spinner size="tiny" /> : undefined}
          onClick={() => {
            setError(null);
            save.mutate();
          }}
        >
          Save policy
        </Button>
        <Button
          icon={preview.isPending ? <Spinner size="tiny" /> : <Eye20Regular />}
          disabled={!enabled || preview.isPending}
          onClick={() => {
            setError(null);
            preview.mutate();
          }}
        >
          Preview
        </Button>
      </div>
    </Card>
  );
}

const itemColumns: TableColumnDefinition<RetentionItemOut>[] = [
  createTableColumn({
    columnId: "candidate",
    renderHeaderCell: () => "Candidate",
    renderCell: (i) => <AppLink href={`/candidates/${i.candidate_id}`}>Open candidate</AppLink>,
  }),
  createTableColumn({
    columnId: "last",
    renderHeaderCell: () => "Last activity",
    renderCell: (i) => formatDateTime(i.last_activity_at),
  }),
  createTableColumn({
    columnId: "status",
    renderHeaderCell: () => "Status",
    renderCell: (i) => RETENTION_ITEM_LABELS[i.status] ?? humanize(i.status),
  }),
];

function RunCard({ runId, onClose }: { runId: string; onClose: () => void }) {
  const styles = useStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const run = useQuery({
    queryKey: privacyKeys.retentionRun(runId),
    queryFn: ({ signal }) => privacyApi.retentionRun(runId, signal),
    refetchInterval: (q) => (q.state.data?.status === "executing" ? 3000 : false),
  });
  const items = useQuery({
    queryKey: privacyKeys.retentionItems(runId, page),
    queryFn: ({ signal }) => privacyApi.retentionItems(runId, page, PAGE_SIZE, signal),
    placeholderData: (prev) => prev,
    refetchInterval: run.data?.status === "executing" ? 3000 : false,
  });
  const cancel = useMutation({
    mutationFn: () => privacyApi.cancelRetention(runId),
    onSuccess: async () => {
      toast.success("Retention run cancelled");
      await queryClient.invalidateQueries({ queryKey: privacyKeys.retentionRuns });
    },
    onError: (e) => toast.error(privacyErrorMessage(e)),
  });
  const r = run.data;
  const previewed = r?.status === "previewed";
  return (
    <Card className={styles.card}>
      <CardHeader
        header={<Subtitle2 as="h2">{previewed ? "Preview" : "Retention run"}</Subtitle2>}
        description={
          r && (
            <Caption1>
              {r.candidate_count.toLocaleString()} candidate(s) · created {formatDateTime(r.created_at)} ·{" "}
              <Badge appearance="tint" color={RETENTION_RUN_COLORS[r.status] ?? "informative"}>
                {humanize(r.status)}
              </Badge>
            </Caption1>
          )
        }
        action={<Button appearance="subtle" icon={<Dismiss20Regular />} aria-label="Close run" onClick={onClose} />}
      />
      {previewed && r.auto_execute_after && (
        <MessageBar intent="info">
          <MessageBarBody>Runs automatically after {formatDateTime(r.auto_execute_after)} unless cancelled.</MessageBarBody>
        </MessageBar>
      )}
      <AdminGrid
        items={items.data?.items}
        columns={itemColumns}
        getRowId={(i) => i.id}
        loading={items.isPending}
        error={items.error}
        emptyText="No candidates match the policy."
        label="Candidates in this run"
        footer={
          items.data && (
            <PagingBar page={page} pageSize={PAGE_SIZE} total={items.data.total} onPageChange={setPage} busy={items.isFetching} />
          )
        }
      />
      {previewed && (
        <div className={styles.actions}>
          <Button appearance="primary" icon={<Play20Regular />} disabled={r.candidate_count === 0} onClick={() => setConfirming(true)}>
            Execute
          </Button>
          <Button disabled={cancel.isPending} onClick={() => cancel.mutate()}>
            Cancel run
          </Button>
        </div>
      )}
      <TypedConfirmDialog
        open={confirming}
        title={`Anonymize ${r?.candidate_count.toLocaleString() ?? ""} candidate(s)?`}
        word={RETENTION_CONFIRM_WORD}
        confirmLabel="Anonymize"
        errorMessage={privacyErrorMessage}
        onClose={() => setConfirming(false)}
        onConfirm={async (typed) => {
          await privacyApi.executeRetention(runId, typed);
          toast.success("Retention run started");
          await queryClient.invalidateQueries({ queryKey: privacyKeys.retentionRuns });
        }}
      >
        <Body1>
          Each candidate is re-checked first; anyone active again is skipped. The rest are permanently anonymized like
          an erasure request. This cannot be undone.
        </Body1>
      </TypedConfirmDialog>
    </Card>
  );
}

function RunHistory({ onOpen }: { onOpen: (id: string) => void }) {
  const styles = useStyles();
  const [page, setPage] = useState(1);
  const runs = useQuery({
    queryKey: privacyKeys.retentionRunList(page),
    queryFn: ({ signal }) => privacyApi.retentionRuns(page, PAGE_SIZE, signal),
    placeholderData: (prev) => prev,
  });
  const columns: TableColumnDefinition<RetentionRunOut>[] = [
    createTableColumn({ columnId: "created", renderHeaderCell: () => "Created", renderCell: (r) => formatDateTime(r.created_at) }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => (
        <Badge appearance="tint" color={RETENTION_RUN_COLORS[r.status] ?? "informative"}>
          {humanize(r.status)}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "count", renderHeaderCell: () => "Candidates", renderCell: (r) => r.candidate_count.toLocaleString() }),
    createTableColumn({
      columnId: "outcome",
      renderHeaderCell: () => "Outcome",
      renderCell: (r) =>
        r.counts && Object.keys(r.counts).length
          ? Object.entries(r.counts)
              .map(([k, v]) => `${RETENTION_ITEM_LABELS[k] ?? humanize(k)}: ${String(v)}`)
              .join(", ")
          : "—",
    }),
    createTableColumn({ columnId: "executed", renderHeaderCell: () => "Executed", renderCell: (r) => formatDateTime(r.executed_at) }),
    createTableColumn({
      columnId: "open",
      renderHeaderCell: () => "",
      renderCell: (r) => (
        <Button size="small" appearance="subtle" onClick={() => onOpen(r.id)}>
          View
        </Button>
      ),
    }),
  ];
  return (
    <Card className={styles.card}>
      <CardHeader header={<Subtitle2 as="h2">Run history</Subtitle2>} />
      <AdminGrid
        items={runs.data?.items}
        columns={columns}
        getRowId={(r) => r.id}
        loading={runs.isPending}
        error={runs.error}
        emptyText="No retention runs yet."
        label="Retention runs"
        footer={runs.data && <PagingBar page={page} pageSize={PAGE_SIZE} total={runs.data.total} onPageChange={setPage} busy={runs.isFetching} />}
      />
    </Card>
  );
}
