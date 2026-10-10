"use client";

import {
  Badge,
  type BadgeProps,
  createTableColumn,
  Dropdown,
  Field,
  makeStyles,
  Option,
  Subtitle2,
  type TableColumnDefinition,
  Text,
  tokens,
} from "@fluentui/react-components";
import { CheckmarkCircle16Filled, DismissCircle16Filled } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { AdminGrid } from "@/features/admin/admin-grid";
import { DetailsDrawer, formatDateTime, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { entityHref } from "@/features/tasks/task-model";
import type { WorkflowExecutionOut, WorkflowRegistryOut } from "@/lib/api/types";
import { workflowApi, workflowKeys } from "./api";
import { actionLines, humanize, traceLines } from "./rule-model";

const PAGE_SIZE = 20;

export const EXECUTION_STATUSES = [
  "succeeded",
  "partially_failed",
  "failed",
  "matched",
  "not_matched",
  "skipped_rate_limit",
  "skipped_loop",
] as const;

const STATUS_COLOR: Record<string, BadgeProps["color"]> = {
  succeeded: "success",
  matched: "success",
  partially_failed: "warning",
  failed: "danger",
  not_matched: "subtle",
  skipped_rate_limit: "informative",
  skipped_loop: "informative",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge appearance="tint" color={STATUS_COLOR[status] ?? "informative"}>
      {humanize(status)}
    </Badge>
  );
}

const useStyles = makeStyles({
  lines: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  line: { display: "flex", gap: tokens.spacingHorizontalS, alignItems: "flex-start" },
  ok: { color: tokens.colorPaletteGreenForeground1, flexShrink: 0, marginTop: "2px" },
  bad: { color: tokens.colorPaletteRedForeground1, flexShrink: 0, marginTop: "2px" },
  muted: { color: tokens.colorNeutralForeground3 },
  section: { marginTop: tokens.spacingVerticalL, marginBottom: tokens.spacingVerticalS },
});

function ExecutionDetail({ e, registry }: { e: WorkflowExecutionOut; registry: WorkflowRegistryOut | undefined }) {
  const styles = useStyles();
  const admin = useAdminStyles();
  const fields = registry?.triggers.flatMap((t) => t.fields) ?? [];
  const labels = Object.fromEntries((registry?.actions ?? []).map((a) => [a.type, a.label]));
  const trace = traceLines(e.condition_trace, fields);
  const actions = actionLines(e.action_results, labels);
  const href = entityHref(e.entity_type, e.entity_id);
  return (
    <>
      <dl className={admin.detailList}>
        <dt>Status</dt>
        <dd>
          <StatusBadge status={e.status} />
        </dd>
        <dt>Mode</dt>
        <dd>{e.mode === "dry_run" ? "Test run" : "Live"}</dd>
        <dt>Trigger</dt>
        <dd>{registry?.triggers.find((t) => t.key === e.trigger)?.label ?? e.trigger}</dd>
        <dt>Record</dt>
        <dd>{href ? <AppLink href={href}>Open {e.entity_type}</AppLink> : `${humanize(e.entity_type)} ${e.entity_id}`}</dd>
        <dt>Started</dt>
        <dd>{formatDateTime(e.started_at ?? e.created_at)}</dd>
        <dt>Duration</dt>
        <dd>{e.duration_ms !== null ? `${e.duration_ms} ms` : "—"}</dd>
        <dt>Rule version</dt>
        <dd>{e.rule_version}</dd>
        <dt>Chain depth</dt>
        <dd>{e.chain_depth}</dd>
      </dl>
      <Subtitle2 as="h3" className={styles.section}>
        Conditions
      </Subtitle2>
      {trace.length === 0 ? (
        <Text className={styles.muted}>No conditions (always).</Text>
      ) : (
        <ul className={styles.lines}>
          {trace.map((t) => (
            <li key={t.key} className={styles.line}>
              {t.ok ? <CheckmarkCircle16Filled className={styles.ok} aria-label="Passed" /> : <DismissCircle16Filled className={styles.bad} aria-label="Failed" />}
              <Text>
                {t.label} <span className={styles.muted}>(actual: {t.actual})</span>
                {t.note && <span className={styles.muted}> — {t.note}</span>}
              </Text>
            </li>
          ))}
        </ul>
      )}
      <Subtitle2 as="h3" className={styles.section}>
        Actions
      </Subtitle2>
      {actions.length === 0 ? (
        <Text className={styles.muted}>No action ran.</Text>
      ) : (
        <ul className={styles.lines}>
          {actions.map((a) => (
            <li key={a.key} className={styles.line}>
              {a.ok ? <CheckmarkCircle16Filled className={styles.ok} aria-label="Succeeded" /> : <DismissCircle16Filled className={styles.bad} aria-label="Failed" />}
              <Text>{a.text.replace(/^Would fail: /, e.mode === "live" ? "Failed: " : "Would fail: ")}</Text>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Executions log of one rule with status / mode filters; a row opens the trace and per-action results. */
export function ExecutionsTab({ ruleId, registry }: { ruleId: string; registry: WorkflowRegistryOut | undefined }) {
  const admin = useAdminStyles();
  const [status, setStatus] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "dry_run" | null>(null);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<WorkflowExecutionOut | null>(null);
  const filters = { status, mode };
  const query = useQuery({
    queryKey: workflowKeys.executions(ruleId, filters, page),
    queryFn: ({ signal }) => workflowApi.executions(ruleId, filters, page, PAGE_SIZE, signal),
    placeholderData: (prev) => prev,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const columns: TableColumnDefinition<WorkflowExecutionOut>[] = [
    createTableColumn({ columnId: "time", renderHeaderCell: () => "Time", renderCell: (e) => formatDateTime(e.created_at) }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (e) => <StatusBadge status={e.status} /> }),
    createTableColumn({
      columnId: "mode",
      renderHeaderCell: () => "Mode",
      renderCell: (e) => (e.mode === "dry_run" ? "Test run" : "Live"),
    }),
    createTableColumn({
      columnId: "trigger",
      renderHeaderCell: () => "Trigger",
      renderCell: (e) => registry?.triggers.find((t) => t.key === e.trigger)?.label ?? e.trigger,
    }),
    createTableColumn({
      columnId: "entity",
      renderHeaderCell: () => "Record",
      renderCell: (e) => {
        const href = entityHref(e.entity_type, e.entity_id);
        return href ? (
          <span onClick={(ev) => ev.stopPropagation()}>
            <AppLink href={href}>{humanize(e.entity_type)}</AppLink>
          </span>
        ) : (
          humanize(e.entity_type)
        );
      },
    }),
    createTableColumn({
      columnId: "duration",
      renderHeaderCell: () => "Duration",
      renderCell: (e) => (e.duration_ms !== null ? `${e.duration_ms} ms` : "—"),
    }),
  ];

  return (
    <>
      <div className={admin.toolbar}>
        <Field label="Status" className={admin.filter}>
          <Dropdown
            value={status ? humanize(status) : "All statuses"}
            selectedOptions={[status ?? "__all__"]}
            onOptionSelect={(_, d) => {
              setStatus(d.optionValue === "__all__" ? null : (d.optionValue ?? null));
              setPage(1);
            }}
          >
            <Option value="__all__">All statuses</Option>
            {EXECUTION_STATUSES.map((s) => (
              <Option key={s} value={s}>
                {humanize(s)}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Mode" className={admin.filter}>
          <Dropdown
            value={mode === "live" ? "Live" : mode === "dry_run" ? "Test runs" : "All runs"}
            selectedOptions={[mode ?? "__all__"]}
            onOptionSelect={(_, d) => {
              setMode(d.optionValue === "__all__" ? null : (d.optionValue as "live" | "dry_run"));
              setPage(1);
            }}
          >
            <Option value="__all__">All runs</Option>
            <Option value="live">Live</Option>
            <Option value="dry_run">Test runs</Option>
          </Dropdown>
        </Field>
      </div>
      <AdminGrid
        items={query.data?.items}
        columns={columns}
        getRowId={(e) => e.id}
        loading={query.isPending}
        error={query.error}
        emptyText="No runs yet."
        label="Rule executions"
        onRowClick={setOpen}
        footer={
          query.data && (
            <PagingBar
              page={page}
              pageSize={PAGE_SIZE}
              total={query.data.total}
              onPageChange={setPage}
              busy={query.isFetching}
            />
          )
        }
      />
      <DetailsDrawer open={!!open} title="Run details" onClose={() => setOpen(null)}>
        {open && <ExecutionDetail e={open} registry={registry} />}
      </DetailsDrawer>
    </>
  );
}
