"use client";

import { Badge, createTableColumn, Dropdown, Option, type TableColumnDefinition, Text } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime, NoAccess, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { reportBuilderApi, reportBuilderKeys } from "./api";
import type { RunLogFilters, RunLogOut } from "./types";

const STATUS_COLOR: Record<string, "success" | "warning" | "danger" | "informative" | "subtle"> = {
  done: "success",
  limit_hit: "warning",
  failed: "danger",
  skipped: "subtle",
  queued: "informative",
  running: "informative",
};

/** `/reports/custom/runs` (Tenant Admin, `audit:read`): every preview, run, export and scheduled delivery. */
export function RunLogView() {
  const admin = useAdminStyles();
  const allowed = usePermission("audit:read");
  const [filters, setFilters] = useState<RunLogFilters>({});
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: reportBuilderKeys.runs(filters, page),
    queryFn: ({ signal }) => reportBuilderApi.runs(filters, page, signal),
    enabled: allowed,
    placeholderData: (prev) => prev,
  });
  if (!allowed) return <NoAccess what="the report run log" />;
  const columns: TableColumnDefinition<RunLogOut>[] = [
    createTableColumn({ columnId: "at", renderHeaderCell: () => "Started", renderCell: (r) => formatDateTime(r.started_at) }),
    createTableColumn({ columnId: "report", renderHeaderCell: () => "Report", renderCell: (r) => r.report_name ?? (r.report_id ? "—" : "Unsaved preview") }),
    createTableColumn({ columnId: "kind", renderHeaderCell: () => "Kind", renderCell: (r) => r.run_kind }),
    createTableColumn({ columnId: "who", renderHeaderCell: () => "Viewer / recipient", renderCell: (r) => r.principal_name ?? r.principal_user_id }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => (
        <span className={admin.badges}>
          <Badge appearance="tint" color={STATUS_COLOR[r.status] ?? "subtle"}>
            {r.status.replace("_", " ")}
          </Badge>
          {r.limit_kind && <Text size={200}>{r.limit_kind === "row_cap" ? "row cap" : "timeout"}</Text>}
          {r.skip_reason && <Text size={200}>{r.skip_reason.replace(/_/g, " ")}</Text>}
          {r.error_code && <Text size={200}>{r.error_code}</Text>}
        </span>
      ),
    }),
    createTableColumn({ columnId: "rows", renderHeaderCell: () => "Rows", renderCell: (r) => r.row_count ?? "—" }),
    createTableColumn({ columnId: "ms", renderHeaderCell: () => "Duration", renderCell: (r) => (r.duration_ms === null ? "—" : `${(r.duration_ms / 1000).toFixed(1)} s`) }),
    createTableColumn({ columnId: "masked", renderHeaderCell: () => "Hidden fields", renderCell: (r) => r.masked_fields.join(", ") || "—" }),
    createTableColumn({ columnId: "delivery", renderHeaderCell: () => "Delivery", renderCell: (r) => (r.delivery === "none" ? "—" : r.delivery) }),
  ];
  return (
    <>
      <PageHeader title="Report run log" subtitle="Previews, runs, exports and scheduled deliveries, with limits hit and hidden fields." />
      <div className={admin.toolbar}>
        <Dropdown className={admin.filter} placeholder="All kinds" value={filters.run_kind ?? ""} selectedOptions={filters.run_kind ? [filters.run_kind] : []} onOptionSelect={(_, d) => { setFilters({ ...filters, run_kind: d.optionValue || undefined }); setPage(1); }}>
          <Option value="">All kinds</Option>
          {["preview", "run", "export", "scheduled"].map((k) => (
            <Option key={k} value={k}>
              {k}
            </Option>
          ))}
        </Dropdown>
        <Dropdown className={admin.filter} placeholder="All statuses" value={filters.status ?? ""} selectedOptions={filters.status ? [filters.status] : []} onOptionSelect={(_, d) => { setFilters({ ...filters, status: d.optionValue || undefined }); setPage(1); }}>
          <Option value="">All statuses</Option>
          {Object.keys(STATUS_COLOR).map((k) => (
            <Option key={k} value={k}>
              {k.replace("_", " ")}
            </Option>
          ))}
        </Dropdown>
      </div>
      <AdminGrid
        items={list.data?.items}
        columns={columns}
        getRowId={(r) => r.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No report runs yet."
        label="Report runs"
        footer={list.data && <PagingBar page={page} pageSize={list.data.page_size} total={list.data.total} onPageChange={setPage} busy={list.isFetching} />}
      />
    </>
  );
}
