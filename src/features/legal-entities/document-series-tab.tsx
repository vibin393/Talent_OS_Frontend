"use client";

import { Badge, Button, createTableColumn, Field, Input, Select, Switch, type TableColumnDefinition, Text } from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid, RowActions } from "@/features/admin/admin-grid";
import { DetailsDrawer, ErrorBar, useAdminStyles } from "@/features/admin/ui";
import { usePermission } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { legalEntitiesApi, legalEntityKeys } from "./api";
import { previewNumber } from "./series";
import type { DocumentSeriesOut, LegalEntityOut, SeriesDocType, SeriesFyFormat, SeriesSeparator } from "./types";

const DOC_TYPE_LABELS: Record<SeriesDocType, string> = {
  invoice: "Invoice",
  credit_note: "Credit note",
  debit_note: "Debit note",
};

const EMPTY = {
  doc_type: "invoice" as SeriesDocType,
  name: "",
  prefix: "",
  fy_format: "YY-YY" as SeriesFyFormat,
  separator: "/" as SeriesSeparator,
  pad: "4",
  gst_registration_id: "",
  allow_backdated: false,
};

/** Legal entity "Document numbering" tab: list, create and deactivate invoice / credit / debit note series. */
export function DocumentSeriesTab({ entity }: { entity: LegalEntityOut }) {
  const admin = useAdminStyles();
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const canWrite = usePermission("document_series:write");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const list = useQuery({ queryKey: legalEntityKeys.series(entity.id), queryFn: ({ signal }) => legalEntitiesApi.series(entity.id, signal) });
  const registrations = useQuery({
    queryKey: legalEntityKeys.registrations(entity.id),
    queryFn: ({ signal }) => legalEntitiesApi.registrations(entity.id, signal),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: legalEntityKeys.series(entity.id) });
  const create = useMutation({
    mutationFn: () =>
      legalEntitiesApi.createSeries(entity.id, {
        doc_type: form.doc_type,
        name: form.name.trim(),
        prefix: form.prefix.trim(),
        fy_format: form.fy_format,
        separator: form.separator,
        pad: Number(form.pad) || 4,
        gst_registration_id: form.gst_registration_id || null,
        allow_backdated: form.allow_backdated,
      }),
    onSuccess: async () => {
      setOpen(false);
      setForm(EMPTY);
      await refresh();
      toast.success("Numbering series created");
    },
  });
  const setStatus = useMutation({
    mutationFn: (v: { s: DocumentSeriesOut; status: "active" | "inactive" }) => legalEntitiesApi.updateSeries(v.s.id, { status: v.status }),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const gstinOf = (id: string | null) => (id ? (registrations.data?.find((r) => r.id === id)?.gstin ?? "—") : "All");

  const columns: TableColumnDefinition<DocumentSeriesOut>[] = [
    createTableColumn({
      columnId: "name",
      renderHeaderCell: () => "Series",
      renderCell: (s) => (
        <span className={admin.badges}>
          {s.name}
          {s.is_legacy && <Badge appearance="tint" color="subtle">Legacy</Badge>}
          {s.status !== "active" && <Badge appearance="tint" color="subtle">Inactive</Badge>}
        </span>
      ),
    }),
    createTableColumn({ columnId: "type", renderHeaderCell: () => "Document", renderCell: (s) => DOC_TYPE_LABELS[s.doc_type] ?? s.doc_type }),
    createTableColumn({ columnId: "gstin", renderHeaderCell: () => "GSTIN", renderCell: (s) => gstinOf(s.gst_registration_id) }),
    createTableColumn({
      columnId: "next",
      renderHeaderCell: () => "Next number",
      renderCell: (s) => s.next_number_preview ?? previewNumber(s.prefix, s.fy_format, s.separator, s.pad),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (s) =>
        canWrite ? (
          <RowActions
            label={s.name}
            actions={[
              s.status === "active"
                ? { label: "Deactivate", onClick: () => setStatus.mutate({ s, status: "inactive" }) }
                : { label: "Reactivate", onClick: () => setStatus.mutate({ s, status: "active" }) },
            ]}
          />
        ) : null,
    }),
  ];

  return (
    <>
      <div className={admin.toolbar}>
        <Text>Invoice, credit note and debit note numbers are issued from the active series of each type.</Text>
        {canWrite && (
          <Button icon={<Add20Regular />} onClick={() => setOpen(true)}>
            New series
          </Button>
        )}
      </div>
      <AdminGrid
        items={list.data}
        columns={columns}
        getRowId={(s) => s.id}
        loading={list.isPending}
        error={list.error}
        emptyText="No numbering series yet. Invoices cannot be issued until an invoice series exists."
        label="Document numbering"
      />
      <DetailsDrawer
        open={open}
        title="New numbering series"
        onClose={() => setOpen(false)}
        footer={
          <div className={admin.footer}>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button appearance="primary" disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}>
              Create
            </Button>
          </div>
        }
      >
        <div className={admin.form}>
          {create.error ? <ErrorBar message={errorMessage(create.error)} /> : null}
          <Field label="Document type" required>
            <Select value={form.doc_type} onChange={(_, d) => setForm((f) => ({ ...f, doc_type: d.value as SeriesDocType }))}>
              {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Name" required>
            <Input value={form.name} maxLength={100} onChange={(_, d) => setForm((f) => ({ ...f, name: d.value }))} placeholder="Main invoices" />
          </Field>
          <Field label="GST registration" hint="Leave as All to use the series for every GSTIN of this entity">
            <Select value={form.gst_registration_id} onChange={(_, d) => setForm((f) => ({ ...f, gst_registration_id: d.value }))}>
              <option value="">All</option>
              {(registrations.data ?? [])
                .filter((r) => r.status === "active")
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.gstin}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Prefix" hint="Up to 10 characters">
            <Input value={form.prefix} maxLength={10} onChange={(_, d) => setForm((f) => ({ ...f, prefix: d.value }))} placeholder="INV" />
          </Field>
          <Field label="Financial year format">
            <Select value={form.fy_format} onChange={(_, d) => setForm((f) => ({ ...f, fy_format: d.value as SeriesFyFormat }))}>
              <option value="YY-YY">25-26</option>
              <option value="YYYY-YY">2025-26</option>
              <option value="YY">26</option>
              <option value="none">None</option>
            </Select>
          </Field>
          <Field label="Separator">
            <Select value={form.separator} onChange={(_, d) => setForm((f) => ({ ...f, separator: d.value as SeriesSeparator }))}>
              <option value="/">/</option>
              <option value="-">-</option>
              <option value="">None</option>
            </Select>
          </Field>
          <Field label="Digits" hint="Zero-padded running number (1 to 10 digits)">
            <Input type="number" min={1} max={10} value={form.pad} onChange={(_, d) => setForm((f) => ({ ...f, pad: d.value }))} />
          </Field>
          <Switch
            label="Allow backdated documents"
            checked={form.allow_backdated}
            onChange={(_, d) => setForm((f) => ({ ...f, allow_backdated: d.checked }))}
          />
          <Text>Preview: {previewNumber(form.prefix, form.fy_format, form.separator, Number(form.pad))}</Text>
        </div>
      </DetailsDrawer>
    </>
  );
}
