"use client";

import {
  Badge,
  Button,
  Caption1,
  createTableColumn,
  Dropdown,
  Field,
  Input,
  makeStyles,
  Option,
  Subtitle2,
  type TableColumnDefinition,
  Toolbar,
  ToolbarButton,
  tokens,
} from "@fluentui/react-components";
import { ArrowDownload20Regular, ArrowLeft20Regular, ArrowClockwise20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { DEFAULT_PAGE_SIZE } from "@/features/admin/query";
import { DetailsDrawer, formatDateTime, NoAccess, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { UserPicker } from "@/features/admin/user-picker";
import { usePermission } from "@/features/auth/use-permission";
import { useUserNames } from "@/features/privacy/use-user-names";
import { api } from "@/lib/api/client";
import { downloadApiFile } from "@/lib/api/download";
import { errorMessage } from "@/lib/api/errors";
import type { Page } from "@/lib/api/types";
import { AppLink } from "@/components/app-link";
import { formatMicrosUsd } from "@/features/ai-governance/logic";
import { useAgentCatalog } from "@/features/ai-governance/api";
import { AI_FEATURE_KEYS, aiFeatureLabel } from "./ai-features";
import {
  AI_LOG_KIND_LABELS,
  AI_LOG_KINDS,
  type AiActionRow,
  type AiLogFilters,
  aiLogQuery,
  EMPTY_AI_LOG_FILTERS,
  UUID_RE,
} from "./ai-log-query";

const STATUSES = ["ok", "failed", "skipped"];
const DECISIONS = ["accepted", "edited", "rejected"];
const SUBJECT_TYPES = ["candidate", "demand", "resume", "application", "client"];
const ALL = "__all__";

const useStyles = makeStyles({
  pre: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    backgroundColor: tokens.colorNeutralBackground3,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    maxHeight: "360px",
    overflowY: "auto",
    margin: 0,
  },
});

function FilterDropdown({
  label,
  value,
  options,
  onChange,
  format = (v: string) => v,
}: {
  label: string;
  value: string | null;
  options: readonly string[];
  onChange: (v: string | null) => void;
  format?: (v: string) => string;
}) {
  const styles = useAdminStyles();
  return (
    <Field label={label} className={styles.filter}>
      <Dropdown
        value={value ? format(value) : "All"}
        selectedOptions={[value ?? ALL]}
        onOptionSelect={(_, d) => onChange(!d.optionValue || d.optionValue === ALL ? null : d.optionValue)}
      >
        <Option value={ALL}>All</Option>
        {options.map((o) => (
          <Option key={o} value={o}>
            {format(o)}
          </Option>
        ))}
      </Dropdown>
    </Field>
  );
}

const statusColor = (s: string) => (s === "ok" ? "success" : s === "failed" ? "danger" : "subtle");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * `/admin/ai/log` (`ai_log:read`): every AI call with filters, a details panel and CSV export (FR-64).
 * Epic 65: agent steps (kind, agent, run, step, cost) and `embedded` inside the AI governance console.
 */
export function AiLog({ embedded = false, initialSearch = "" }: { embedded?: boolean; initialSearch?: string } = {}) {
  const styles = useAdminStyles();
  const local = useStyles();
  const router = useRouter();
  const toast = useAppToast();
  const canRead = usePermission("ai_log:read");
  const userName = useUserNames();
  const [filters, setFilters] = useState<AiLogFilters>(() => ({ ...EMPTY_AI_LOG_FILTERS, search: initialSearch }));
  const agentCatalog = useAgentCatalog(canRead);
  const agentKeys = (agentCatalog.data ?? []).map((a) => a.key);
  const agentName = (k: string) => agentCatalog.data?.find((a) => a.key === k)?.name ?? k;
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AiActionRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const query = aiLogQuery(filters, page, DEFAULT_PAGE_SIZE);
  const list = useQuery({
    queryKey: ["ai", "actions", query],
    queryFn: ({ signal }) => api.get<Page<AiActionRow>>(`/api/v1/ai/actions?${query}`, { signal }),
    enabled: canRead,
    placeholderData: (prev) => prev,
  });
  if (!canRead) return <NoAccess what="the AI action log" />;

  const update = (patch: Partial<AiLogFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const who = (a: AiActionRow) =>
    a.initiator_type === "user" ? (userName(a.initiator_id) ?? "A user") : a.initiator_type ? cap(a.initiator_type) : "—";

  const columns: TableColumnDefinition<AiActionRow>[] = [
    createTableColumn({ columnId: "when", compare: (a, b) => a.created_at.localeCompare(b.created_at), renderHeaderCell: () => "When", renderCell: (a) => formatDateTime(a.created_at) }),
    createTableColumn({ columnId: "feature", compare: (a, b) => a.feature.localeCompare(b.feature), renderHeaderCell: () => "Feature", renderCell: (a) => aiFeatureLabel(a.feature) }),
    createTableColumn({ columnId: "kind", renderHeaderCell: () => "Kind", renderCell: (a) => AI_LOG_KIND_LABELS[a.kind ?? "single"] ?? "One-shot" }),
    createTableColumn({ columnId: "agent", renderHeaderCell: () => "Agent", renderCell: (a) => (a.agent_key ? agentName(a.agent_key) : "—") }),
    createTableColumn({
      columnId: "run",
      renderHeaderCell: () => "Run",
      renderCell: (a) => (a.agent_run_id ? <AppLink href={`/admin/ai/runs/${a.agent_run_id}`}>View run</AppLink> : "—"),
    }),
    createTableColumn({ columnId: "step", renderHeaderCell: () => "Step", renderCell: (a) => (a.step_no ?? "—") }),
    createTableColumn({ columnId: "cost", renderHeaderCell: () => "Cost (USD)", renderCell: (a) => formatMicrosUsd(a.cost_micros) }),
    createTableColumn({ columnId: "who", renderHeaderCell: () => "Initiated by", renderCell: who }),
    createTableColumn({
      columnId: "subject",
      renderHeaderCell: () => "Entity",
      renderCell: (a) => (a.subject_type ? cap(a.subject_type) : "—"),
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (a) => (
        <Badge appearance="tint" color={statusColor(a.status)}>
          {cap(a.status)}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "decision", renderHeaderCell: () => "Decision", renderCell: (a) => (a.decision ? cap(a.decision) : "—") }),
    createTableColumn({
      columnId: "tokens",
      compare: (a, b) => (a.input_tokens ?? 0) + (a.output_tokens ?? 0) - ((b.input_tokens ?? 0) + (b.output_tokens ?? 0)),
      renderHeaderCell: () => "Tokens",
      renderCell: (a) => ((a.input_tokens ?? 0) + (a.output_tokens ?? 0)).toLocaleString(),
    }),
    createTableColumn({
      columnId: "open",
      renderHeaderCell: () => "",
      renderCell: (a) => (
        <Button size="small" appearance="subtle" onClick={() => setSelected(a)}>
          Details
        </Button>
      ),
    }),
  ];

  return (
    <>
      {!embedded && (
        <>
          <div>
            <Button appearance="subtle" icon={<ArrowLeft20Regular />} onClick={() => router.push("/admin/ai")}>
              AI settings
            </Button>
          </div>
          <PageHeader title="AI action log" subtitle="Every AI call: who asked, what it was about, the model's output and the human decision." />
        </>
      )}
      <Toolbar aria-label="AI log commands" className={styles.toolbar}>
        <ToolbarButton
          icon={<ArrowDownload20Regular />}
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              const { headers } = await downloadApiFile(`/api/v1/ai/actions/export.csv?${aiLogQuery(filters)}`, "ai-actions.csv");
              if (headers.get("X-Export-Truncated") === "true") toast.info("Only the first 50,000 rows were exported. Narrow the filters to export the rest.");
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setExporting(false);
            }
          }}
        >
          Export CSV
        </ToolbarButton>
        <ToolbarButton icon={<ArrowClockwise20Regular />} onClick={() => list.refetch()}>
          Refresh
        </ToolbarButton>
      </Toolbar>
      <div className={styles.toolbar}>
        <Field
          label="Run or AI action id"
          className={styles.search}
          hint={filters.search && !UUID_RE.test(filters.search.trim()) ? "Paste a full ID" : undefined}
        >
          <Input value={filters.search ?? ""} onChange={(_, d) => update({ search: d.value })} placeholder="Run or AI action id" />
        </Field>
        <FilterDropdown label="Kind" value={filters.kind ?? null} options={AI_LOG_KINDS} format={(v) => AI_LOG_KIND_LABELS[v] ?? v} onChange={(v) => update({ kind: v })} />
        {agentKeys.length > 0 && <FilterDropdown label="Agent" value={filters.agentKey ?? null} options={agentKeys} format={agentName} onChange={(v) => update({ agentKey: v })} />}
        <FilterDropdown label="Feature" value={filters.feature} options={AI_FEATURE_KEYS} format={aiFeatureLabel} onChange={(v) => update({ feature: v })} />
        <UserPicker
          label="User"
          className={styles.filter}
          value={filters.initiatorId}
          valueLabel={filters.initiatorLabel}
          clearLabel="Anyone"
          activeOnly={false}
          onChange={(id, u) => update({ initiatorId: id, initiatorLabel: u ? u.name || u.email : undefined })}
        />
        <FilterDropdown label="Entity" value={filters.subjectType} options={SUBJECT_TYPES} format={cap} onChange={(v) => update({ subjectType: v })} />
        <Field label="Entity ID" className={styles.filter} hint={filters.subjectId && !UUID_RE.test(filters.subjectId.trim()) ? "Paste a full ID" : undefined}>
          <Input value={filters.subjectId} onChange={(_, d) => update({ subjectId: d.value })} placeholder="Optional" />
        </Field>
        <FilterDropdown label="Decision" value={filters.decision} options={DECISIONS} format={cap} onChange={(v) => update({ decision: v })} />
        <FilterDropdown label="Status" value={filters.status} options={STATUSES} format={cap} onChange={(v) => update({ status: v })} />
        <Field label="From" className={styles.filter}>
          <Input type="date" value={filters.from} onChange={(_, d) => update({ from: d.value })} />
        </Field>
        <Field label="To" className={styles.filter}>
          <Input type="date" value={filters.to} onChange={(_, d) => update({ to: d.value })} />
        </Field>
      </div>
      <AdminGrid
        items={list.data?.items}
        columns={columns}
        getRowId={(a) => a.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No AI actions match these filters."
        label="AI actions"
        sortable
        footer={list.data && <PagingBar page={page} pageSize={DEFAULT_PAGE_SIZE} total={list.data.total} onPageChange={setPage} busy={list.isFetching} />}
      />
      <DetailsDrawer open={selected !== null} size="large" title={selected ? aiFeatureLabel(selected.feature) : ""} onClose={() => setSelected(null)}>
        {selected && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <dl className={styles.detailList}>
              <dt>When</dt>
              <dd>{formatDateTime(selected.created_at)}</dd>
              <dt>Initiated by</dt>
              <dd>{who(selected)}</dd>
              <dt>Entity</dt>
              <dd>{selected.subject_type ? `${cap(selected.subject_type)} ${selected.subject_id ?? ""}` : "—"}</dd>
              <dt>Prompt version</dt>
              <dd>{[selected.prompt_id, selected.prompt_version].filter(Boolean).join(" · ") || "—"}</dd>
              <dt>Model</dt>
              <dd>{selected.model ?? "—"}</dd>
              <dt>Tokens</dt>
              <dd>
                {(selected.input_tokens ?? 0).toLocaleString()} in · {(selected.output_tokens ?? 0).toLocaleString()} out
              </dd>
              <dt>Latency</dt>
              <dd>{selected.latency_ms !== null ? `${selected.latency_ms.toLocaleString()} ms` : "—"}</dd>
              <dt>Consent basis</dt>
              <dd>{selected.consent_basis ? cap(selected.consent_basis.replace(/_/g, " ")) : "—"}</dd>
              <dt>Status</dt>
              <dd>
                {cap(selected.status)}
                {selected.error_code ? ` (${selected.error_code})` : ""}
              </dd>
              <dt>Decision</dt>
              <dd>
                {selected.decision
                  ? `${cap(selected.decision)}${selected.decided_at ? ` · ${formatDateTime(selected.decided_at)}` : ""}${selected.decided_by ? ` · ${userName(selected.decided_by) ?? ""}` : ""}`
                  : "No decision recorded"}
              </dd>
            </dl>
            {selected.limitations_note && (
              <div>
                <Subtitle2 as="h3">Limitations</Subtitle2>
                <Caption1>{selected.limitations_note}</Caption1>
              </div>
            )}
            <div>
              <Subtitle2 as="h3">Output</Subtitle2>
              <pre className={local.pre}>
                {selected.output === null || selected.output === undefined
                  ? "—"
                  : typeof selected.output === "string"
                    ? selected.output
                    : JSON.stringify(selected.output, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </DetailsDrawer>
    </>
  );
}
