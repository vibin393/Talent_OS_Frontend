"use client";

import { Badge, Button, createTableColumn, Link, SearchBox, Tab, TabList, type TableColumnDefinition, Text, Tooltip } from "@fluentui/react-components";
import { Add20Regular, CalendarClock20Regular, History20Regular } from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime, NoAccess, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { useDebounced } from "@/lib/use-debounced";
import { type ReportTab, reportBuilderApi, reportBuilderKeys } from "./api";
import type { ReportOut } from "./types";

export function NeedsRepairBadge() {
  return (
    <Badge appearance="filled" color="danger">
      Needs repair
    </Badge>
  );
}

function sharedWith(r: ReportOut): string {
  if (!r.shares.length) return "Only me";
  return r.shares.map((s) => s.name ?? s.target_kind).join(", ");
}

/** `/reports/custom`: Mine / Shared with me, with source, owner, sharing, last run, schedules and repair state. */
export function ReportsListView() {
  const admin = useAdminStyles();
  const router = useRouter();
  const canRead = usePermission("report:read");
  const canBuild = usePermission("report:build");
  const canRunLog = usePermission("audit:read");
  const [tab, setTab] = useState<ReportTab>(canBuild ? "mine" : "shared");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounced(q, 300).trim();
  const list = useQuery({
    queryKey: reportBuilderKeys.list(tab, debounced, "", page),
    queryFn: ({ signal }) => reportBuilderApi.list(tab, debounced, "", page, signal),
    enabled: canRead || canBuild,
    placeholderData: (prev) => prev,
  });
  if (!canRead && !canBuild) return <NoAccess what="custom reports" />;
  const columns: TableColumnDefinition<ReportOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Name",
      renderCell: (r) => (
        <span className={admin.badges}>
          <Link as="button" onClick={() => router.push(`/reports/custom/${r.id}`)}>
            {r.name}
          </Link>
          {r.status === "needs_repair" && <NeedsRepairBadge />}
        </span>
      ),
    }),
    createTableColumn({ columnId: "source", renderHeaderCell: () => "Source", renderCell: (r) => r.source_label ?? r.source_key }),
    createTableColumn({ columnId: "owner", renderHeaderCell: () => "Owner", renderCell: (r) => (r.is_owner ? "Me" : (r.owner_name ?? "—")) }),
    createTableColumn({ columnId: "shared", renderHeaderCell: () => "Shared with", renderCell: (r) => <Text className={admin.truncate}>{sharedWith(r)}</Text> }),
    createTableColumn({ columnId: "last", renderHeaderCell: () => "Last run", renderCell: (r) => formatDateTime(r.last_run_at) }),
    createTableColumn({
      columnId: "schedule",
      renderHeaderCell: () => "Scheduled",
      renderCell: (r) =>
        r.schedule_count > 0 ? (
          <Tooltip relationship="label" content={`${r.schedule_count} schedule${r.schedule_count === 1 ? "" : "s"}`}>
            <CalendarClock20Regular />
          </Tooltip>
        ) : (
          "—"
        ),
    }),
  ];
  return (
    <>
      <PageHeader title="Custom reports" subtitle="Build reports on governed data. Each viewer sees only the rows and fields they may see." />
      <div className={admin.toolbar}>
        <TabList selectedValue={tab} onTabSelect={(_, d) => { setTab(d.value as ReportTab); setPage(1); }}>
          {canBuild && <Tab value="mine">Mine</Tab>}
          <Tab value="shared">Shared with me</Tab>
        </TabList>
        <SearchBox className={admin.search} placeholder="Search reports" value={q} onChange={(_, d) => { setQ(d.value); setPage(1); }} aria-label="Search reports" />
        <span className={admin.grow} />
        {canRunLog && (
          <Button icon={<History20Regular />} onClick={() => router.push("/reports/custom/runs")}>
            Run log
          </Button>
        )}
        {canBuild && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => router.push("/reports/custom/new")}>
            New report
          </Button>
        )}
      </div>
      <AdminGrid
        items={list.data?.items}
        columns={columns}
        getRowId={(r) => r.id}
        loading={list.isPending}
        error={list.error}
        emptyText={tab === "mine" ? "You have no custom reports yet." : "Nothing has been shared with you yet."}
        label="Custom reports"
        onRowClick={(r) => router.push(`/reports/custom/${r.id}`)}
        footer={list.data && <PagingBar page={page} pageSize={list.data.page_size} total={list.data.total} onPageChange={setPage} busy={list.isFetching} />}
      />
    </>
  );
}
