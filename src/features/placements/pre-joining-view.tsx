"use client";

import { Badge, createTableColumn, Link, ProgressBar, type TableColumnDefinition, Tooltip } from "@fluentui/react-components";
import { CheckmarkCircle16Regular, PersonWarning16Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime, NoAccess } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { placementKeys, placementsApi } from "./api";
import { daysToStartLabel, DROPOUT_RULE_LABELS, formatDate } from "./format";
import type { PreJoiningRow } from "./types";
import { usePredictionColumn } from "@/features/predictions/prediction-badge";

/** `/placements/pre-joining`: placements starting within 30 days, sorted by days-to-start. */
export function PreJoiningView() {
  const router = useRouter();
  const canRead = usePermission("placement:read");
  const q = useQuery({ queryKey: placementKeys.preJoining(30), queryFn: ({ signal }) => placementsApi.preJoining(30, signal), enabled: canRead });
  // Epic 48: optional joining-drop risk column (batch predictions; none without `prediction:read`).
  const predictionColumns = usePredictionColumn("placement", q.data, (r: PreJoiningRow) => r.placement_id);
  if (!canRead) return <NoAccess what="placements" />;
  const columns: TableColumnDefinition<PreJoiningRow>[] = [
    createTableColumn({
      columnId: "id",
      renderHeaderCell: () => "Placement",
      renderCell: (r) => (
        <Link as="button" onClick={() => router.push(`/placements/${r.placement_id}`)}>
          {r.human_id}
        </Link>
      ),
    }),
    createTableColumn({ columnId: "worker", renderHeaderCell: () => "Worker", renderCell: (r) => r.candidate_name ?? "—" }),
    createTableColumn({ columnId: "client", renderHeaderCell: () => "Client", renderCell: (r) => r.client_name ?? "—" }),
    createTableColumn({
      columnId: "start",
      renderHeaderCell: () => "Starts",
      renderCell: (r) => `${formatDate(r.planned_start_date)} · ${daysToStartLabel(r.days_to_start)}`,
    }),
    createTableColumn({
      columnId: "onboarding",
      renderHeaderCell: () => "Onboarding",
      renderCell: (r) =>
        r.onboarding_pct === null ? "—" : <ProgressBar value={r.onboarding_pct / 100} thickness="large" aria-label={`${r.onboarding_pct}% onboarded`} />,
    }),
    createTableColumn({
      columnId: "bgv",
      renderHeaderCell: () => "BGV",
      renderCell: (r) => (r.bgv_summary?.status ? <Badge appearance="tint">{r.bgv_summary.status.replace(/_/g, " ")}</Badge> : "—"),
    }),
    createTableColumn({
      columnId: "gates",
      renderHeaderCell: () => "Gates",
      renderCell: (r) => (
        <Badge appearance="tint" color={r.gates_unmet ? "warning" : "success"}>
          {r.gates_total - r.gates_unmet}/{r.gates_total} met
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "contact", renderHeaderCell: () => "Last contact", renderCell: (r) => formatDateTime(r.last_contact_at) }),
    createTableColumn({
      columnId: "flags",
      renderHeaderCell: () => "Confirmed / risk",
      renderCell: (r) => (
        <>
          {r.joining_confirmed_at && (
            <Tooltip content="Joining confirmed" relationship="label">
              <CheckmarkCircle16Regular />
            </Tooltip>
          )}
          {r.dropout_risk && (
            <Tooltip content={r.dropout_risk_rules.map((x) => DROPOUT_RULE_LABELS[x] ?? x).join(", ")} relationship="label">
              <PersonWarning16Regular />
            </Tooltip>
          )}
        </>
      ),
    }),
    ...predictionColumns,
  ];
  return (
    <>
      <PageHeader title="Pre-joining" subtitle="Joiners in the next 30 days: onboarding, BGV, start gates and dropout risk" />
      <AdminGrid
        items={q.data}
        columns={columns}
        getRowId={(r) => r.placement_id}
        loading={q.isPending}
        error={q.error}
        emptyText="Nobody is starting in the next 30 days."
        label="Pre-joining tracker"
        onRowClick={(r) => router.push(`/placements/${r.placement_id}`)}
      />
    </>
  );
}
