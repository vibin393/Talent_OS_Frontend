"use client";

import { Button, createTableColumn, Dropdown, Link, Option, SearchBox, type TableColumnDefinition, Text } from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { NoAccess, useAdminStyles } from "@/features/admin/ui";
import { useDebounced } from "@/lib/use-debounced";
import { DRIVE_STATUS_LABELS, formatDate } from "../logic";
import type { DriveListItem, DriveStatus } from "../types";
import { DriveStatusBadge, useCampusStyles } from "../ui";
import { useCampusPermissions, useDrives } from "../use-campus";

const STATUSES = Object.keys(DRIVE_STATUS_LABELS) as DriveStatus[];

/** `/campus/drives`: campus hiring drives. */
export function DrivesList() {
  const admin = useAdminStyles();
  const styles = useCampusStyles();
  const router = useRouter();
  const { canRead, canManage } = useCampusPermissions();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<DriveStatus | "">("");
  const dq = useDebounced(q, 300);
  const drives = useDrives({ q: dq.trim() || undefined, status }, canRead);
  if (!canRead) return <NoAccess what="campus drives" />;

  const open = (d: DriveListItem) => router.push(`/campus/drives/${d.id}`);
  const columns: TableColumnDefinition<DriveListItem>[] = [
    createTableColumn({
      columnId: "name",
      compare: (a, b) => a.name.localeCompare(b.name),
      renderHeaderCell: () => "Drive",
      renderCell: (d) => (
        <Link
          as="button"
          onClick={(e) => {
            e.stopPropagation();
            open(d);
          }}
        >
          {d.name}
        </Link>
      ),
    }),
    createTableColumn({ columnId: "batch", compare: (a, b) => a.batch_year - b.batch_year, renderHeaderCell: () => "Batch", renderCell: (d) => d.batch_year }),
    createTableColumn({ columnId: "status", renderHeaderCell: () => "Status", renderCell: (d) => <DriveStatusBadge status={d.status} /> }),
    createTableColumn({
      columnId: "institutions",
      renderHeaderCell: () => "Institutions",
      renderCell: (d) => <Text className={styles.num}>{d.institution_count}</Text>,
    }),
    createTableColumn({
      columnId: "registrations",
      compare: (a, b) => a.registration_count - b.registration_count,
      renderHeaderCell: () => "Registrations",
      renderCell: (d) => <Text className={styles.num}>{d.registration_count.toLocaleString()}</Text>,
    }),
    createTableColumn({ columnId: "closes", renderHeaderCell: () => "Registration closes", renderCell: (d) => formatDate(d.registration_closes_at) }),
    createTableColumn({ columnId: "owner", renderHeaderCell: () => "Owner", renderCell: (d) => d.owner_name ?? "—" }),
  ];

  return (
    <>
      <PageHeader title="Campus drives" subtitle="Hire a graduating batch across Institutions: registration, eligibility, assessments, interviews and offers" />
      <div className={admin.toolbar}>
        <SearchBox className={admin.search} placeholder="Search drives" aria-label="Search drives" value={q} onChange={(_, d) => setQ(d.value)} />
        <Dropdown
          className={admin.filter}
          aria-label="Status"
          value={status ? DRIVE_STATUS_LABELS[status] : "All statuses"}
          selectedOptions={[status]}
          onOptionSelect={(_, d) => setStatus((d.optionValue ?? "") as DriveStatus | "")}
        >
          <Option value="">All statuses</Option>
          {STATUSES.map((s) => (
            <Option key={s} value={s}>
              {DRIVE_STATUS_LABELS[s]}
            </Option>
          ))}
        </Dropdown>
        <span className={admin.grow} />
        {canManage && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => router.push("/campus/drives/new")}>
            New drive
          </Button>
        )}
      </div>
      <AdminGrid
        items={drives.data}
        columns={columns}
        getRowId={(d) => d.id}
        loading={drives.isPending}
        error={drives.error}
        emptyText="No drives yet."
        label="Campus drives"
        sortable
        onRowClick={open}
      />
    </>
  );
}
