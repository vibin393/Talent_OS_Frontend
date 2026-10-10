"use client";

import { createTableColumn, Subtitle2, type TableColumnDefinition } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { marketplaceApi, marketplaceKeys, type Processor } from "./api";
import { categoryLabel, countryName, STATUS_LABELS } from "./labels";

const columns: TableColumnDefinition<Processor>[] = [
  createTableColumn({ columnId: "name", renderHeaderCell: () => "Name", renderCell: (p) => p.name }),
  createTableColumn({ columnId: "publisher", renderHeaderCell: () => "Publisher", renderCell: (p) => p.publisher ?? "—" }),
  createTableColumn({ columnId: "category", renderHeaderCell: () => "Category", renderCell: (p) => categoryLabel(p.category) }),
  createTableColumn({ columnId: "countries", renderHeaderCell: () => "Data stored in", renderCell: (p) => p.countries.map(countryName).join(", ") }),
  createTableColumn({ columnId: "installed", renderHeaderCell: () => "Installed on", renderCell: (p) => formatDateTime(p.installed_on) }),
  createTableColumn({
    columnId: "status",
    renderHeaderCell: () => "Status",
    renderCell: (p) => (p.status && p.status in STATUS_LABELS ? STATUS_LABELS[p.status as keyof typeof STATUS_LABELS].label : (p.status ?? "—")),
  }),
];

/** Epic 69 (spec A6): the additive "Integrations installed by your organisation" section of the sub-processors page. */
export function InstalledProcessorsSection() {
  const canView = usePermission("integration:view");
  const q = useQuery({ queryKey: marketplaceKeys.processors, queryFn: ({ signal }) => marketplaceApi.processors(signal), enabled: canView });
  if (!canView) return null;
  return (
    <>
      <Subtitle2 as="h2">Integrations installed by your organisation</Subtitle2>
      <AdminGrid
        items={q.data?.filter((p) => p.source === "installed")}
        columns={columns}
        getRowId={(p) => p.installation_id ?? p.name}
        loading={q.isPending}
        error={q.error}
        emptyText="Your organisation hasn't installed any integrations."
        label="Integrations installed by your organisation"
      />
    </>
  );
}
