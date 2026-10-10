"use client";

import { Badge, Caption1, createTableColumn, type TableColumnDefinition, Tooltip } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime, useAdminStyles } from "@/features/admin/ui";
import type { AIActionOut } from "@/lib/api/types";
import { candidateKeys, candidatesApi } from "./api";
import { aiFeatureLabel } from "./format";

const STATUS_COLOR: Record<string, "success" | "danger" | "warning" | "informative"> = {
  ok: "success",
  failed: "danger",
  skipped: "warning",
};
const DECISION_COLOR: Record<string, "success" | "warning" | "danger"> = {
  accepted: "success",
  edited: "warning",
  rejected: "danger",
};

/** AI actions for this candidate (AD-6 audit trail): feature, prompt version, model, status, latency, tokens, decision. */
export function AiInsightsTab({ candidateId }: { candidateId: string }) {
  const styles = useAdminStyles();
  const actions = useQuery({
    queryKey: candidateKeys.aiActions(candidateId),
    queryFn: ({ signal }) => candidatesApi.aiActions(candidateId, signal),
  });

  const columns: TableColumnDefinition<AIActionOut>[] = [
    createTableColumn<AIActionOut>({
      columnId: "when",
      renderHeaderCell: () => "When",
      renderCell: (a) => formatDateTime(a.created_at),
    }),
    createTableColumn<AIActionOut>({
      columnId: "feature",
      renderHeaderCell: () => "Feature",
      renderCell: (a) => (
        <div className={styles.cellStack}>
          <span>{aiFeatureLabel(a.feature)}</span>
          <Caption1 className={styles.muted}>{a.prompt_version ?? a.prompt_id}</Caption1>
        </div>
      ),
    }),
    createTableColumn<AIActionOut>({
      columnId: "model",
      renderHeaderCell: () => "Model",
      renderCell: (a) => a.model ?? "—",
    }),
    createTableColumn<AIActionOut>({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (a) => (
        <Tooltip content={a.error_code ?? a.limitations_note ?? a.status} relationship="description">
          <Badge appearance="tint" color={STATUS_COLOR[a.status] ?? "informative"}>
            {a.status}
            {a.error_code ? ` · ${a.error_code}` : ""}
          </Badge>
        </Tooltip>
      ),
    }),
    createTableColumn<AIActionOut>({
      columnId: "latency",
      renderHeaderCell: () => "Latency",
      renderCell: (a) => (a.latency_ms === null ? "—" : `${(a.latency_ms / 1000).toFixed(1)} s`),
    }),
    createTableColumn<AIActionOut>({
      columnId: "tokens",
      renderHeaderCell: () => "Tokens (in / out)",
      renderCell: (a) => (a.input_tokens === null && a.output_tokens === null ? "—" : `${a.input_tokens ?? 0} / ${a.output_tokens ?? 0}`),
    }),
    createTableColumn<AIActionOut>({
      columnId: "decision",
      renderHeaderCell: () => "Decision",
      renderCell: (a) =>
        a.decision ? (
          <div className={styles.cellStack}>
            <Badge appearance="tint" color={DECISION_COLOR[a.decision] ?? "informative"}>
              {a.decision}
            </Badge>
            {a.decided_at && <Caption1 className={styles.muted}>{formatDateTime(a.decided_at)}</Caption1>}
          </div>
        ) : (
          <span className={styles.muted}>Pending</span>
        ),
    }),
  ];

  return (
    <AdminGrid
      label="AI actions"
      items={actions.data}
      columns={columns}
      getRowId={(a) => a.id}
      loading={actions.isPending}
      error={actions.error}
      emptyText="No AI actions for this candidate."
      columnSizing={{ feature: { minWidth: 200, idealWidth: 220 }, status: { minWidth: 160 } }}
    />
  );
}
