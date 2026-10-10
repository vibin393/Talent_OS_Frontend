"use client";

import {
  Badge,
  Checkbox,
  createTableColumn,
  Field,
  Input,
  type TableColumnDefinition,
  Toolbar,
  ToolbarButton,
} from "@fluentui/react-components";
import { ArrowClockwise20Regular, ArrowDownload20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppLink } from "@/components/app-link";
import { AdminGrid } from "@/features/admin/admin-grid";
import { DEFAULT_PAGE_SIZE } from "@/features/admin/query";
import { formatDateTime, IdMultiSelect, IdSelect, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { UserPicker } from "@/features/admin/user-picker";
import type { RunSummary } from "@/lib/api/agentic-types";
import { governanceApi, governanceKeys, useAgentCatalog } from "./api";
import { ConsoleShell } from "./console-shell";
import {
  EMPTY_RUN_FILTERS,
  formatDuration,
  formatMicrosUsd,
  formatTokens,
  humanize,
  ORIGINS,
  RUN_STATUS_COLORS,
  RUN_STATUS_LABELS,
  RUN_STATUSES,
  runDurationSeconds,
  type RunFilters,
  runFilterParams,
  runRef,
  runsQuery,
  runStatusLabel,
  subjectHref,
} from "./logic";
import { useP4Export } from "./use-p4-export";

/** `/admin/ai/runs` (`ai:govern`): every agent run with filters and CSV export. */
export function RunsPage() {
  return (
    <ConsoleShell>
      <RunsBody />
    </ConsoleShell>
  );
}

function RunsBody() {
  const styles = useAdminStyles();
  const [filters, setFilters] = useState<RunFilters>(EMPTY_RUN_FILTERS);
  const [page, setPage] = useState(1);
  const agents = useAgentCatalog();
  const exporter = useP4Export("agent_runs");
  const query = runsQuery(filters, page, DEFAULT_PAGE_SIZE);
  const list = useQuery({
    queryKey: governanceKeys.runs(query),
    queryFn: ({ signal }) => governanceApi.runs(query, signal),
    placeholderData: (prev) => prev,
  });
  const update = (patch: Partial<RunFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const agentOptions = useMemo(() => (agents.data ?? []).map((a) => ({ id: a.key, label: a.name })), [agents.data]);

  const columns: TableColumnDefinition<RunSummary>[] = [
    createTableColumn({
      columnId: "run",
      renderHeaderCell: () => "Run",
      renderCell: (r) => <AppLink href={`/admin/ai/runs/${r.id}`}>{runRef(r.id)}</AppLink>,
    }),
    createTableColumn({ columnId: "agent", compare: (a, b) => a.agent_name.localeCompare(b.agent_name), renderHeaderCell: () => "Agent", renderCell: (r) => r.agent_name }),
    createTableColumn({ columnId: "for", renderHeaderCell: () => "For", renderCell: (r) => r.actor_label }),
    createTableColumn({
      columnId: "subject",
      renderHeaderCell: () => "Subject",
      renderCell: (r) => {
        if (!r.subject_type) return "—";
        const href = subjectHref(r.subject_type, r.subject_id);
        const text = humanize(r.subject_type);
        return href ? <AppLink href={href}>{text}</AppLink> : text;
      },
    }),
    createTableColumn({ columnId: "trigger", renderHeaderCell: () => "Trigger", renderCell: (r) => humanize(r.trigger_key ?? r.trigger_kind) }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => (
        <Badge appearance="tint" color={RUN_STATUS_COLORS[r.status] ?? "subtle"}>
          {runStatusLabel(r.status)}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "reason", renderHeaderCell: () => "Reason", renderCell: (r) => (r.reason_code ? humanize(r.reason_code) : "—") }),
    createTableColumn({ columnId: "steps", compare: (a, b) => a.step_count - b.step_count, renderHeaderCell: () => "Steps", renderCell: (r) => r.step_count }),
    createTableColumn({ columnId: "calls", compare: (a, b) => a.tool_call_count - b.tool_call_count, renderHeaderCell: () => "Tool calls", renderCell: (r) => r.tool_call_count }),
    createTableColumn({
      columnId: "tokens",
      compare: (a, b) => a.input_tokens + a.output_tokens - (b.input_tokens + b.output_tokens),
      renderHeaderCell: () => "Tokens",
      renderCell: (r) => formatTokens(r.input_tokens + r.output_tokens),
    }),
    createTableColumn({ columnId: "cost", compare: (a, b) => a.cost_micros - b.cost_micros, renderHeaderCell: () => "Cost (USD)", renderCell: (r) => formatMicrosUsd(r.cost_micros) }),
    createTableColumn({ columnId: "started", compare: (a, b) => (a.started_at ?? a.created_at).localeCompare(b.started_at ?? b.created_at), renderHeaderCell: () => "Started", renderCell: (r) => formatDateTime(r.started_at) }),
    createTableColumn({ columnId: "duration", renderHeaderCell: () => "Duration", renderCell: (r) => formatDuration(runDurationSeconds(r)) }),
    createTableColumn({ columnId: "queue", renderHeaderCell: () => "Queue age", renderCell: (r) => formatDuration(r.queue_age_seconds) }),
  ];

  return (
    <>
      <Toolbar aria-label="Run commands" className={styles.toolbar}>
        <ToolbarButton icon={<ArrowDownload20Regular />} disabled={exporter.pending} onClick={() => void exporter.run(runFilterParams(filters))}>
          Export CSV
        </ToolbarButton>
        <ToolbarButton icon={<ArrowClockwise20Regular />} onClick={() => void list.refetch()}>
          Refresh
        </ToolbarButton>
      </Toolbar>
      <div className={styles.toolbar}>
        <IdSelect label="Agent" className={styles.filter} options={agentOptions} value={filters.agentKey} noneLabel="All agents" onChange={(v) => update({ agentKey: v })} />
        <div className={styles.filter}>
          <IdMultiSelect
            label="Status"
            options={RUN_STATUSES.map((s) => ({ id: s, label: RUN_STATUS_LABELS[s] }))}
            value={filters.statuses}
            placeholder="Any status"
            onChange={(v) => update({ statuses: v })}
          />
        </div>
        <IdSelect
          label="Origin"
          className={styles.filter}
          options={ORIGINS.map((o) => ({ id: o.value, label: o.label }))}
          value={filters.origin}
          noneLabel="Any origin"
          onChange={(v) => update({ origin: v })}
        />
        <UserPicker
          label="Owner"
          className={styles.filter}
          value={filters.ownerId}
          valueLabel={filters.ownerLabel}
          clearLabel="Anyone"
          activeOnly={false}
          onChange={(id, u) => update({ ownerId: id, ownerLabel: u ? u.name || u.email : undefined })}
        />
        <Field label="Subject type" className={styles.filter}>
          <Input value={filters.subjectType} placeholder="e.g. demand" onChange={(_, d) => update({ subjectType: d.value })} />
        </Field>
        <Field label="Subject" className={styles.filter}>
          <Input value={filters.subjectId} placeholder="ID or human ID" onChange={(_, d) => update({ subjectId: d.value })} />
        </Field>
        <Field label="From" className={styles.filter}>
          <Input type="date" value={filters.from} onChange={(_, d) => update({ from: d.value })} />
        </Field>
        <Field label="To" className={styles.filter}>
          <Input type="date" value={filters.to} onChange={(_, d) => update({ to: d.value })} />
        </Field>
        <Checkbox label="Tainted only" checked={filters.taintedOnly} onChange={(_, d) => update({ taintedOnly: !!d.checked })} />
        <Checkbox label="With policy violations" checked={filters.withViolations} onChange={(_, d) => update({ withViolations: !!d.checked })} />
      </div>
      <AdminGrid
        items={list.data?.items}
        columns={columns}
        getRowId={(r) => r.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No agent runs match these filters."
        label="Agent runs"
        sortable
        footer={list.data && <PagingBar page={page} pageSize={DEFAULT_PAGE_SIZE} total={list.data.total} onPageChange={setPage} busy={list.isFetching} />}
      />
    </>
  );
}
