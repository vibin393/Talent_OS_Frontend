"use client";

import { Badge, createTableColumn, type TableColumnDefinition, TableCellLayout } from "@fluentui/react-components";
import { AdminGrid } from "@/features/admin/admin-grid";
import { formatDateTime } from "@/features/admin/ui";
import { useUserNames } from "@/features/approvals/use-user-names";
import { OFFER_STATUS } from "./format";
import type { OfferOut } from "./types";

/** `DataGrid` of offers: candidate, version, status, released, expires, owner. */
export function OffersGrid({
  items,
  loading,
  error,
  onOpen,
  showDemand = false,
  emptyText = "No offers yet.",
}: {
  items: OfferOut[] | undefined;
  loading: boolean;
  error: unknown;
  onOpen: (o: OfferOut) => void;
  showDemand?: boolean;
  emptyText?: string;
}) {
  const nameOf = useUserNames();
  const columns: TableColumnDefinition<OfferOut>[] = [
    createTableColumn({
      columnId: "candidate",
      renderHeaderCell: () => "Candidate",
      compare: (a, b) => (a.candidate_name ?? "").localeCompare(b.candidate_name ?? ""),
      renderCell: (o) => (
        <TableCellLayout truncate description={showDemand ? (o.demand_title ?? o.human_id) : o.human_id}>
          {o.candidate_name ?? "Candidate"}
        </TableCellLayout>
      ),
    }),
    createTableColumn({ columnId: "version", renderHeaderCell: () => "Version", renderCell: (o) => `v${o.current_version.version_no}` }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      compare: (a, b) => a.status.localeCompare(b.status),
      renderCell: (o) => (
        <Badge appearance="tint" color={OFFER_STATUS[o.status].color}>
          {OFFER_STATUS[o.status].label}
        </Badge>
      ),
    }),
    createTableColumn({
      columnId: "released",
      renderHeaderCell: () => "Released",
      compare: (a, b) => (a.released_at ?? "").localeCompare(b.released_at ?? ""),
      renderCell: (o) => formatDateTime(o.released_at),
    }),
    createTableColumn({
      columnId: "expires",
      renderHeaderCell: () => "Expires",
      compare: (a, b) => (a.expires_at ?? a.current_version.expiry_date).localeCompare(b.expires_at ?? b.current_version.expiry_date),
      renderCell: (o) => (o.expires_at ? formatDateTime(o.expires_at) : o.current_version.expiry_date),
    }),
    createTableColumn({ columnId: "owner", renderHeaderCell: () => "Owner", renderCell: (o) => nameOf(o.owner_id) ?? "—" }),
  ];
  return (
    <AdminGrid
      items={items}
      columns={columns}
      getRowId={(o) => o.id}
      loading={loading}
      error={error}
      emptyText={emptyText}
      label="Offers"
      sortable
      onRowClick={onOpen}
      columnSizing={{
        candidate: { minWidth: 180, idealWidth: 220 },
        version: { minWidth: 70, idealWidth: 80 },
        status: { minWidth: 120, idealWidth: 140 },
        released: { minWidth: 150, idealWidth: 170 },
        expires: { minWidth: 150, idealWidth: 170 },
        owner: { minWidth: 120, idealWidth: 150 },
      }}
    />
  );
}
