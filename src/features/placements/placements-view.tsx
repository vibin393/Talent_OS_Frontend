"use client";

import {
  Badge,
  Button,
  createTableColumn,
  Dropdown,
  Field,
  Input,
  Link,
  makeStyles,
  mergeClasses,
  Option,
  Tab,
  TabList,
  type TableColumnDefinition,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import {
  Add20Regular,
  ArrowDownload20Regular,
  CalendarClock16Regular,
  PersonWarning16Regular,
  ShieldError16Regular,
  Wrench16Regular,
} from "@fluentui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { NoAccess, PagingBar, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { type PlacementFilters, placementKeys, placementQuery, placementsApi } from "./api";
import { formatDate, SAVED_VIEWS, STATUS_COLORS, STATUS_LABELS } from "./format";
import { NewPlacementDrawer } from "./new-placement-drawer";
import type { PlacementListItem, PlacementStatus } from "./types";

const useStyles = makeStyles({
  flags: { display: "inline-flex", gap: tokens.spacingHorizontalXS, color: tokens.colorPaletteMarigoldForeground2 },
  danger: { color: tokens.colorPaletteRedForeground1 },
  tabs: { marginBottom: tokens.spacingVerticalM },
});

const STATUSES = Object.keys(STATUS_LABELS) as PlacementStatus[];

export function PlacementFlags({ p }: { p: PlacementListItem }) {
  const styles = useStyles();
  return (
    <span className={styles.flags}>
      {p.ending_soon && (
        <Tooltip content="Ending soon" relationship="label">
          <CalendarClock16Regular />
        </Tooltip>
      )}
      {(p.non_compliant || p.compliance_blocked) && (
        <Tooltip content="Non-compliant" relationship="label">
          <ShieldError16Regular className={mergeClasses(styles.danger)} />
        </Tooltip>
      )}
      {p.dropout_risk && (
        <Tooltip content="Dropout risk" relationship="label">
          <PersonWarning16Regular className={mergeClasses(styles.danger)} />
        </Tooltip>
      )}
      {p.setup_items.length > 0 && (
        <Tooltip content="Setup incomplete" relationship="label">
          <Wrench16Regular />
        </Tooltip>
      )}
    </span>
  );
}

/** `/placements`: saved views, filters, status badges and flags; "New placement" for direct creation. */
export function PlacementsView() {
  const admin = useAdminStyles();
  const styles = useStyles();
  const router = useRouter();
  const canRead = usePermission("placement:read");
  const canCreate = usePermission("placement:create");
  const canExport = usePermission("report:export");
  const [view, setView] = useState("all");
  const [status, setStatus] = useState<string[]>([]);
  const [workerType, setWorkerType] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const filters: PlacementFilters = {
    view: view === "all" ? undefined : view,
    status: status.length ? status : undefined,
    worker_type: workerType || undefined,
    q: q.trim() || undefined,
    page,
    page_size: 25,
  };
  const list = useQuery({
    queryKey: placementKeys.list(filters),
    queryFn: ({ signal }) => placementsApi.list(filters, signal),
    enabled: canRead,
  });
  if (!canRead) return <NoAccess what="placements" />;
  const columns: TableColumnDefinition<PlacementListItem>[] = [
    createTableColumn({
      columnId: "id",
      renderHeaderCell: () => "Placement",
      renderCell: (p) => (
        <Link as="button" onClick={() => router.push(`/placements/${p.id}`)}>
          {p.human_id}
        </Link>
      ),
    }),
    createTableColumn({ columnId: "worker", renderHeaderCell: () => "Worker", renderCell: (p) => p.candidate_name ?? "—" }),
    createTableColumn({ columnId: "client", renderHeaderCell: () => "Client", renderCell: (p) => p.client_name ?? "—" }),
    createTableColumn({ columnId: "role", renderHeaderCell: () => "Role", renderCell: (p) => p.role_title ?? "—" }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (p) => (
        <Badge appearance="tint" color={STATUS_COLORS[p.status]}>
          {STATUS_LABELS[p.status]}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "start", renderHeaderCell: () => "Start", renderCell: (p) => formatDate(p.actual_start_date ?? p.planned_start_date) }),
    createTableColumn({ columnId: "end", renderHeaderCell: () => "End", renderCell: (p) => formatDate(p.end_date ?? p.planned_end_date) }),
    createTableColumn({ columnId: "flags", renderHeaderCell: () => "Flags", renderCell: (p) => <PlacementFlags p={p} /> }),
  ];
  const exportHref = `/api/v1/placements/export${placementQuery({ ...filters, page: undefined, page_size: undefined })}`;
  return (
    <>
      <PageHeader title="Placements" subtitle="Engagements the firm bills and pays against" />
      <TabList
        className={styles.tabs}
        selectedValue={view}
        onTabSelect={(_, d) => {
          setView(String(d.value));
          setPage(1);
        }}
      >
        {SAVED_VIEWS.map((v) => (
          <Tab key={v.value} value={v.value}>
            {v.label}
          </Tab>
        ))}
      </TabList>
      <div className={admin.toolbar}>
        <Field label="Search" className={admin.search}>
          <Input value={q} placeholder="PLC id or worker name" onChange={(_, d) => { setQ(d.value); setPage(1); }} />
        </Field>
        <Field label="Status" className={admin.filter}>
          <Dropdown
            multiselect
            placeholder="Any"
            selectedOptions={status}
            value={status.map((s) => STATUS_LABELS[s as PlacementStatus]).join(", ")}
            onOptionSelect={(_, d) => { setStatus(d.selectedOptions); setPage(1); }}
          >
            {STATUSES.map((s) => (
              <Option key={s} value={s}>
                {STATUS_LABELS[s]}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="Worker type" className={admin.filter}>
          <Dropdown
            placeholder="Any"
            selectedOptions={workerType ? [workerType] : []}
            value={workerType ? workerType.replace("_", " ") : ""}
            onOptionSelect={(_, d) => { setWorkerType(d.optionValue === "any" ? "" : (d.optionValue ?? "")); setPage(1); }}
          >
            <Option value="any">Any</Option>
            <Option value="employee">Employee</Option>
            <Option value="contractor">Contractor</Option>
            <Option value="vendor_contractor">Vendor contractor</Option>
          </Dropdown>
        </Field>
        <span className={admin.grow} />
        {canExport && (
          <Button as="a" href={exportHref} appearance="secondary" icon={<ArrowDownload20Regular />}>
            Export
          </Button>
        )}
        {canCreate && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreating(true)}>
            New placement
          </Button>
        )}
      </div>
      <AdminGrid
        items={list.data?.items}
        columns={columns}
        getRowId={(p) => p.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No placements match these filters."
        label="Placements"
        onRowClick={(p) => router.push(`/placements/${p.id}`)}
      />
      {list.data && <PagingBar page={page} pageSize={list.data.page_size} total={list.data.total} onPageChange={setPage} busy={list.isFetching} />}
      {creating && <NewPlacementDrawer onClose={() => setCreating(false)} />}
    </>
  );
}
