"use client";

import {
  Badge,
  Body1,
  Card,
  Caption1,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  makeStyles,
  Subtitle1,
  type TableColumnDefinition,
  tokens,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, formatDateTime, GridSkeleton, NoAccess, PagingBar } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { submissionPackKeys, submissionPacksApi } from "./api";
import { packBadge } from "./logic";
import type { PackMetricsOut, PackSummaryOut } from "./types";

const useStyles = makeStyles({
  metrics: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalL },
  card: { padding: tokens.spacingHorizontalM, gap: tokens.spacingVerticalXS },
  muted: { color: tokens.colorNeutralForeground3 },
  empty: { padding: tokens.spacingVerticalXXL, color: tokens.colorNeutralForeground3 },
});

function hours(value: number | null): string {
  if (value == null) return "—";
  return value >= 48 ? `${(value / 24).toFixed(1)} days` : `${value.toFixed(1)} h`;
}

function MetricCards({ m }: { m: PackMetricsOut }) {
  const styles = useStyles();
  return (
    <div className={styles.metrics}>
      <Card className={styles.card}>
        <Caption1 className={styles.muted}>Median shortlisted → submitted</Caption1>
        <Subtitle1>{hours(m.median_hours_with_pack)}</Subtitle1>
        <Caption1 className={styles.muted}>Without a pack: {hours(m.median_hours_without_pack)}</Caption1>
      </Card>
      <Card className={styles.card}>
        <Caption1 className={styles.muted}>Packs sent with ≤ 1 change</Caption1>
        <Subtitle1>{m.pct_low_change == null ? "—" : `${m.pct_low_change}%`}</Subtitle1>
        <Caption1 className={styles.muted}>
          {m.packs_low_change} of {m.packs_used} sent packs
        </Caption1>
      </Card>
    </div>
  );
}

/** `/pipeline/submission-packs` -- prepared submission packs (Epic 61, B4). */
export function PacksList() {
  const styles = useStyles();
  const canRead = usePermission("submission:read");
  const canMetrics = usePermission("submission:read", "bu");
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: submissionPackKeys.list({ page }),
    queryFn: ({ signal }) => submissionPacksApi.list({ page }, signal),
    enabled: canRead,
    placeholderData: (prev) => prev,
  });
  const metrics = useQuery({ queryKey: submissionPackKeys.metrics, queryFn: ({ signal }) => submissionPacksApi.metrics(signal), enabled: canMetrics });
  const columns: TableColumnDefinition<PackSummaryOut>[] = [
    createTableColumn({ columnId: "pack", renderHeaderCell: () => "Pack", renderCell: (p) => p.human_id }),
    createTableColumn({
      columnId: "candidate",
      renderHeaderCell: () => "Candidate",
      renderCell: (p) => <AppLink href={`/candidates/${p.candidate_id}`}>{p.candidate_name ?? "Candidate"}</AppLink>,
    }),
    createTableColumn({
      columnId: "demand",
      renderHeaderCell: () => "Demand",
      renderCell: (p) => <AppLink href={`/demands/${p.demand_id}`}>{p.demand_title ?? "Demand"}</AppLink>,
    }),
    createTableColumn({ columnId: "client", renderHeaderCell: () => "Client", renderCell: (p) => p.client_name ?? "—" }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (p) => {
        const b = packBadge({ status: p.status, lifecycle: p.lifecycle, resume_stale: false });
        return (
          <Badge appearance="tint" color={b.color}>
            {b.label}
          </Badge>
        );
      },
    }),
    createTableColumn({ columnId: "blockers", renderHeaderCell: () => "Blockers", renderCell: (p) => String(p.blocker_count) }),
    createTableColumn({ columnId: "prepared", renderHeaderCell: () => "Prepared", renderCell: (p) => formatDateTime(p.updated_at) }),
    createTableColumn({ columnId: "owner", renderHeaderCell: () => "Owner", renderCell: (p) => p.owner_name ?? "—" }),
  ];
  const items = list.data?.items ?? [];
  return (
    <>
      <PageHeader title="Submission packs" subtitle="Draft submissions prepared for review. A person reviews and sends every submission." />
      {!canRead ? (
        <NoAccess what="submission packs" />
      ) : (
        <>
          {metrics.data && <MetricCards m={metrics.data} />}
          {list.isPending ? (
            <GridSkeleton rows={6} />
          ) : list.isError ? (
            <ErrorBar title="Could not load the submission packs." message={errorMessage(list.error)} />
          ) : items.length === 0 ? (
            <Body1 className={styles.empty}>No submission packs yet.</Body1>
          ) : (
            <>
              <DataGrid items={items} columns={columns} getRowId={(p) => p.id} aria-label="Submission packs">
                <DataGridHeader>
                  <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
                </DataGridHeader>
                <DataGridBody<PackSummaryOut>>
                  {({ item, rowId }) => (
                    <DataGridRow<PackSummaryOut> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>
                  )}
                </DataGridBody>
              </DataGrid>
              <PagingBar page={page} pageSize={list.data?.page_size ?? 25} total={list.data?.total ?? 0} onPageChange={setPage} busy={list.isFetching} />
            </>
          )}
        </>
      )}
    </>
  );
}
