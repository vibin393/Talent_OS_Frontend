"use client";

import {
  Badge,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Tab,
  TabList,
  type TableColumnDefinition,
  Text,
} from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, GridSkeleton, NoAccess, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { formatDate } from "@/features/placements/format";
import { exitApi, exitKeys } from "./api";
import { CASE_REASON_LABELS, CASE_STATUS_COLORS, CASE_STATUS_LABELS, exitErrorMessage } from "./logic";
import type { OffboardingCaseOut } from "./types";

type Filter = "open" | "closed" | "cancelled" | "all";

/** `/offboarding`: offboarding cases by status. */
export function OffboardingCasesView() {
  const admin = useAdminStyles();
  const canRead = usePermission("placement:read");
  const [status, setStatus] = useState<Filter>("open");
  const q = useQuery({ queryKey: exitKeys.cases(status), queryFn: ({ signal }) => exitApi.cases(status, signal), enabled: canRead });
  if (!canRead) return <NoAccess what="offboarding cases" />;

  const columns: TableColumnDefinition<OffboardingCaseOut>[] = [
    createTableColumn({
      columnId: "case",
      renderHeaderCell: () => "Case",
      renderCell: (c) => (
        <div className={admin.cellStack}>
          <NextLink href={`/offboarding/${c.id}`}>{c.human_id}</NextLink>
          <Text size={200} className={admin.muted}>
            {c.candidate_name ?? "Worker"} · {c.placement_human_id ?? ""}
          </Text>
        </div>
      ),
    }),
    createTableColumn({ columnId: "client", renderHeaderCell: () => "Client", renderCell: (c) => c.client_name ?? "—" }),
    createTableColumn({ columnId: "reason", renderHeaderCell: () => "Reason", renderCell: (c) => CASE_REASON_LABELS[c.reason] ?? c.reason }),
    createTableColumn({ columnId: "lwd", renderHeaderCell: () => "Last working day", renderCell: (c) => formatDate(c.last_working_day) }),
    createTableColumn({
      columnId: "items",
      renderHeaderCell: () => "Open items",
      renderCell: (c) => `${c.items_open} / ${c.items_total}`,
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (c) => (
        <div className={admin.badges}>
          <Badge appearance="tint" color={CASE_STATUS_COLORS[c.status]}>
            {CASE_STATUS_LABELS[c.status]}
          </Badge>
          {c.early_attrition && (
            <Badge appearance="tint" color="danger">
              Early attrition
            </Badge>
          )}
        </div>
      ),
    }),
  ];

  return (
    <>
      <PageHeader title="Offboarding" subtitle="Exit checklists, final settlement and closure." />
      <TabList selectedValue={status} onTabSelect={(_, d) => setStatus(d.value as Filter)}>
        <Tab value="open">Open</Tab>
        <Tab value="closed">Closed</Tab>
        <Tab value="cancelled">Cancelled</Tab>
        <Tab value="all">All</Tab>
      </TabList>
      {q.isError && <ErrorBar message={exitErrorMessage(q.error)} />}
      {q.isPending ? (
        <GridSkeleton />
      ) : (q.data ?? []).length === 0 ? (
        <div className={admin.empty}>No cases.</div>
      ) : (
        <div className={admin.surface}>
          <DataGrid items={q.data ?? []} columns={columns} getRowId={(c: OffboardingCaseOut) => c.id} className={admin.grid}>
            <DataGridHeader>
              <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
            </DataGridHeader>
            <DataGridBody<OffboardingCaseOut>>
              {({ item, rowId }) => (
                <DataGridRow<OffboardingCaseOut> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>
              )}
            </DataGridBody>
          </DataGrid>
        </div>
      )}
    </>
  );
}
