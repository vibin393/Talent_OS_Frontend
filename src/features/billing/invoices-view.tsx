"use client";

import {
  Button,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Dropdown,
  Field,
  Input,
  Option,
  type TableColumnDefinition,
} from "@fluentui/react-components";
import { ArrowDownload20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import {
  ErrorBar,
  GridSkeleton,
  NoAccess,
  useAdminStyles,
} from "@/features/admin/ui";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import type { InvoiceFilters } from "./api";
import { EinvoiceBadge, Money, StatusBadge } from "./components";
import { DscStatusBadge } from "./dsc/dsc-status-badge";
import { EINVOICE_LABELS, STATUS_LABELS } from "./logic";
import type { DocStatus, DocSummaryOut, EinvoiceStatus } from "./types";
import { useInvoices } from "./use-invoices";

/** CSV of the visible rows (amounts stay decimal strings). */
export function invoicesCsv(rows: DocSummaryOut[]): string {
  const esc = (v: unknown) => {
    const t = v == null ? "" : String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const head = [
    "number",
    "status",
    "doc_date",
    "due_date",
    "client",
    "currency",
    "taxable_total",
    "tax_total",
    "document_total",
    "einvoice_status",
    "delivery_status",
  ];
  const body = rows.map((r) =>
    [
      r.number,
      r.status,
      r.doc_date,
      r.due_date,
      r.client_name,
      r.currency,
      r.taxable_total,
      r.charged_tax_total,
      r.document_total,
      r.einvoice_status,
      r.delivery_status,
    ]
      .map(esc)
      .join(","),
  );
  return [head.join(","), ...body].join("\n");
}

function FilterDropdown<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (v: string) => void;
}) {
  const admin = useAdminStyles();
  return (
    <Field label={label} className={admin.filter}>
      <Dropdown
        placeholder="Any"
        value={value ? labels[value as T] : ""}
        selectedOptions={value ? [value] : []}
        onOptionSelect={(_, d) =>
          onChange(d.optionValue === "any" ? "" : (d.optionValue ?? ""))
        }
      >
        <Option value="any">Any</Option>
        {options.map((o) => (
          <Option key={o} value={o}>
            {labels[o]}
          </Option>
        ))}
      </Dropdown>
    </Field>
  );
}

/** `/billing/invoices`: keyboard-first invoice grid with saved-view style filters and CSV export. */
export function InvoicesView() {
  const admin = useAdminStyles();
  const router = useRouter();
  const perms = usePermissions();
  const canRead = hasAnyPermission(perms, ["billing:read", "billing:write"]);
  const [f, setF] = useState<InvoiceFilters>({});
  const query = useInvoices(f, canRead);
  if (!canRead) return <NoAccess what="invoices" />;
  const set = (k: keyof InvoiceFilters) => (v: string) =>
    setF((cur) => ({ ...cur, [k]: v || undefined }));
  const columns: TableColumnDefinition<DocSummaryOut>[] = [
    createTableColumn({
      columnId: "number",
      renderHeaderCell: () => "Number",
      renderCell: (r) => r.number ?? "Draft",
    }),
    createTableColumn({
      columnId: "date",
      renderHeaderCell: () => "Date",
      renderCell: (r) => r.doc_date ?? r.preview_date ?? "—",
    }),
    createTableColumn({
      columnId: "client",
      renderHeaderCell: () => "Client",
      renderCell: (r) => r.client_name ?? "—",
    }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => (
        <span className={admin.badges}>
          <StatusBadge status={r.status} />
          <EinvoiceBadge status={r.einvoice_status} />
          <DscStatusBadge status={r.dsc_status} />
        </span>
      ),
    }),
    createTableColumn({
      columnId: "delivery",
      renderHeaderCell: () => "Delivery",
      renderCell: (r) => r.delivery_status.replace("_", " "),
    }),
    createTableColumn({
      columnId: "total",
      renderHeaderCell: () => "Total",
      renderCell: (r) => (
        <Money amount={r.document_total} currency={r.currency} strong />
      ),
    }),
  ];
  const download = () => {
    const blob = new Blob([invoicesCsv(query.data ?? [])], {
      type: "text/csv",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "invoices.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const open = (id: string) =>
    router.push(`/billing/invoices/${encodeURIComponent(id)}`);
  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="GST tax invoices, drafts and their e-invoice status"
      />
      <div className={admin.toolbar}>
        <FilterDropdown
          label="Status"
          value={f.status ?? ""}
          options={Object.keys(STATUS_LABELS) as DocStatus[]}
          labels={STATUS_LABELS}
          onChange={set("status")}
        />
        <FilterDropdown
          label="E-invoice"
          value={f.einvoice_status ?? ""}
          options={Object.keys(EINVOICE_LABELS) as EinvoiceStatus[]}
          labels={EINVOICE_LABELS}
          onChange={set("einvoice_status")}
        />
        <FilterDropdown
          label="Delivery"
          value={f.delivery_status ?? ""}
          options={["not_sent", "sent", "viewed"] as const}
          labels={{ not_sent: "Not sent", sent: "Sent", viewed: "Viewed" }}
          onChange={set("delivery_status")}
        />
        <Field label="From" className={admin.filter}>
          <Input
            type="date"
            value={f.date_from ?? ""}
            onChange={(_, d) => set("date_from")(d.value)}
          />
        </Field>
        <Field label="To" className={admin.filter}>
          <Input
            type="date"
            value={f.date_to ?? ""}
            onChange={(_, d) => set("date_to")(d.value)}
          />
        </Field>
        <span className={admin.grow} />
        <Button
          icon={<ArrowDownload20Regular />}
          onClick={download}
          disabled={!query.data?.length}
        >
          Export CSV
        </Button>
      </div>
      {query.error && !query.data ? (
        <ErrorBar
          title="Could not load invoices."
          message={errorMessage(query.error)}
        />
      ) : (
        <div className={admin.surface}>
          {!query.data ? (
            <GridSkeleton />
          ) : query.data.length === 0 ? (
            <div className={admin.empty}>No invoices match these filters.</div>
          ) : (
            <DataGrid
              items={query.data}
              columns={columns}
              getRowId={(r) => r.id}
              aria-label="Invoices"
              className={admin.grid}
              focusMode="composite"
            >
              <DataGridHeader>
                <DataGridRow>
                  {({ renderHeaderCell }) => (
                    <DataGridHeaderCell>
                      {renderHeaderCell()}
                    </DataGridHeaderCell>
                  )}
                </DataGridRow>
              </DataGridHeader>
              <DataGridBody<DocSummaryOut>>
                {({ item, rowId }) => (
                  <DataGridRow<DocSummaryOut>
                    key={rowId}
                    style={{ cursor: "pointer" }}
                    onClick={() => open(item.id)}
                    onKeyDown={(e: React.KeyboardEvent) =>
                      e.key === "Enter" && open(item.id)
                    }
                  >
                    {({ renderCell }) => (
                      <DataGridCell>{renderCell(item)}</DataGridCell>
                    )}
                  </DataGridRow>
                )}
              </DataGridBody>
            </DataGrid>
          )}
        </div>
      )}
    </>
  );
}
