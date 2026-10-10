"use client";

import { Badge, createTableColumn, type TableColumnDefinition, Link } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdminGrid } from "@/features/admin/admin-grid";
import { InstalledProcessorsSection } from "@/features/marketplace/installed-processors";
import type { SubProcessorOut } from "@/lib/api/types";
import { noticeKeys, noticesApi } from "./api";

export const SUB_PROCESSOR_STATUS_COLORS: Record<string, "success" | "informative" | "subtle"> = {
  active: "success",
  planned: "informative",
  retired: "subtle",
};

export const subProcessorColumns: TableColumnDefinition<SubProcessorOut>[] = [
  createTableColumn({
    columnId: "name",
    compare: (a, b) => a.name.localeCompare(b.name),
    renderHeaderCell: () => "Name",
    renderCell: (s) =>
      s.website && /^https?:\/\//i.test(s.website) ? (
        <Link href={s.website} target="_blank" rel="noopener noreferrer">
          {s.name}
        </Link>
      ) : (
        s.name
      ),
  }),
  createTableColumn({ columnId: "purpose", renderHeaderCell: () => "Purpose", renderCell: (s) => s.purpose }),
  createTableColumn({ columnId: "data", renderHeaderCell: () => "Data categories", renderCell: (s) => s.data_categories.join(", ") || "—" }),
  createTableColumn({
    columnId: "location",
    compare: (a, b) => a.country.localeCompare(b.country),
    renderHeaderCell: () => "Location",
    renderCell: (s) => `${s.processing_location} (${s.country})`,
  }),
  createTableColumn({
    columnId: "effective",
    compare: (a, b) => a.effective_from.localeCompare(b.effective_from),
    renderHeaderCell: () => "Effective from",
    renderCell: (s) => new Date(s.effective_from).toLocaleDateString(undefined, { dateStyle: "medium" }),
  }),
  createTableColumn({
    columnId: "status",
    renderHeaderCell: () => "Status",
    renderCell: (s) => (
      <Badge appearance="tint" color={SUB_PROCESSOR_STATUS_COLORS[s.status] ?? "informative"}>
        {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
      </Badge>
    ),
  }),
];

/** `/sub-processors`: read-only list of the platform's sub-processors (DPDP transparency, FR-71). */
export function SubProcessorsView() {
  const list = useQuery({ queryKey: noticeKeys.subProcessors, queryFn: ({ signal }) => noticesApi.subProcessors(signal) });
  return (
    <>
      <PageHeader
        title="Sub-processors"
        subtitle="Third parties that process personal data on behalf of Talent OS. New sub-processors are announced at least 30 days in advance."
      />
      <AdminGrid
        items={list.data}
        columns={subProcessorColumns}
        getRowId={(s) => s.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No sub-processors are listed."
        label="Sub-processors"
        sortable
      />
      <InstalledProcessorsSection />
    </>
  );
}
