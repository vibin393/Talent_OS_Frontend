"use client";

import {
  Badge,
  type BadgeProps,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  type TableColumnDefinition,
} from "@fluentui/react-components";
import { useAdminStyles } from "@/features/admin/ui";
import { DOC_STATUS_LABELS, SUBMISSION_STATUS_LABELS, VENDOR_STATUS_LABELS } from "./format";
import type { DocStatus, SubmissionStatus, VendorStatus } from "./types";

type Color = NonNullable<BadgeProps["color"]>;

const VENDOR_COLORS: Record<VendorStatus, Color> = {
  prospective: "informative",
  onboarding: "warning",
  active: "success",
  suspended: "danger",
  inactive: "subtle",
};

export function VendorStatusBadge({ status }: { status: VendorStatus }) {
  return (
    <Badge appearance="tint" color={VENDOR_COLORS[status]}>
      {VENDOR_STATUS_LABELS[status]}
    </Badge>
  );
}

export function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return <>—</>;
  const color: Color = tier === "gold" ? "warning" : tier === "silver" ? "informative" : "subtle";
  return (
    <Badge appearance="outline" color={color}>
      {tier[0].toUpperCase() + tier.slice(1)}
    </Badge>
  );
}

const DOC_COLORS: Record<DocStatus, Color> = { valid: "success", expiring: "warning", expired: "danger", no_expiry: "subtle" };

export function DocStatusBadge({ status }: { status: DocStatus }) {
  return (
    <Badge appearance="tint" color={DOC_COLORS[status]}>
      {DOC_STATUS_LABELS[status]}
    </Badge>
  );
}

const SUB_COLORS: Record<SubmissionStatus, Color> = {
  submitted: "informative",
  under_review: "brand",
  accepted: "success",
  rejected: "danger",
  duplicate: "warning",
  withdrawn: "subtle",
};

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  return (
    <Badge appearance="tint" color={SUB_COLORS[status]}>
      {SUBMISSION_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Plain read-only `DataGrid` over rows with an `id`. */
export function SimpleGrid<T extends { id: string }>({ items, columns }: { items: T[]; columns: TableColumnDefinition<T>[] }) {
  const admin = useAdminStyles();
  return (
    <DataGrid items={items} columns={columns} getRowId={(i) => i.id} className={admin.grid}>
      <DataGridHeader>
        <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
      </DataGridHeader>
      <DataGridBody<T>>
        {({ item, rowId }) => <DataGridRow<T> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>}
      </DataGridBody>
    </DataGrid>
  );
}
