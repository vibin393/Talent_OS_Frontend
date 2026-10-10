"use client";

import {
  Badge,
  Button,
  createTableColumn,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  type TableColumnDefinition,
} from "@fluentui/react-components";
import { ArrowClockwise20Regular, ArrowDownload20Regular, ArrowUpload20Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRef, useState } from "react";
import { ErrorBar, formatDateTime, GridSkeleton, useAdminStyles } from "@/features/admin/ui";
import { errorMessage } from "@/lib/api/errors";
import { dscApi, dscKeys } from "./api";
import { ageBadgeColor, dscErrorMessage, formatAge } from "./logic";
import type { DscPending, DscUploadResult } from "./types";

type RowResult = { label: string } & ({ ok: true; result: DscUploadResult } | { ok: false; message: string });

const KIND_LABEL = { invoice: "Invoice", credit_note: "Credit note" } as const;
const rowLabel = (r: DscPending) => `${KIND_LABEL[r.kind] ?? "Document"} ${r.number ?? ""}`.trim();
const docHref = (r: DscPending) => (r.kind === "invoice" ? `/billing/invoices/${r.doc_id}` : `/billing/credit-notes/${r.doc_id}`);

/** Queue of invoices / credit notes waiting for a DSC signature (Manual adapter or failed automatic signing). */
export function DscPendingView() {
  const admin = useAdminStyles();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: dscKeys.pending, queryFn: ({ signal }) => dscApi.pending(signal), refetchInterval: 60_000 });
  const [results, setResults] = useState<Record<string, RowResult>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<DscPending | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: dscKeys.all });

  const upload = useMutation({
    mutationFn: ({ row, file }: { row: DscPending; file: File }) => dscApi.upload(row.kind, row.doc_id, file),
    onMutate: ({ row }) => setBusy(row.request_id),
    onSuccess: (result, { row }) => {
      setResults((cur) => ({ ...cur, [row.request_id]: { label: rowLabel(row), ok: true, result } }));
      void refresh();
    },
    onError: (e, { row }) => setResults((cur) => ({ ...cur, [row.request_id]: { label: rowLabel(row), ok: false, message: dscErrorMessage(e) } })),
    onSettled: () => setBusy(null),
  });
  const retry = useMutation({
    mutationFn: (row: DscPending) => dscApi.retry(row.kind, row.doc_id),
    onMutate: (row) => setBusy(row.request_id),
    onSuccess: () => void refresh(),
    onError: (e) => setActionError(dscErrorMessage(e)),
    onSettled: () => setBusy(null),
  });

  const download = async (row: DscPending) => {
    setActionError(null);
    try {
      await dscApi.downloadRender(row.kind, row.doc_id, row.number);
    } catch (e) {
      setActionError(errorMessage(e));
    }
  };

  const columns: TableColumnDefinition<DscPending>[] = [
    createTableColumn({ columnId: "kind", renderHeaderCell: () => "Kind", renderCell: (r) => KIND_LABEL[r.kind] ?? r.kind }),
    createTableColumn({
      columnId: "number",
      renderHeaderCell: () => "Number",
      renderCell: (r) => <Link href={docHref(r)}>{r.number ?? "—"}</Link>,
    }),
    createTableColumn({ columnId: "client", renderHeaderCell: () => "Client", renderCell: (r) => r.client_name ?? "—" }),
    createTableColumn({
      columnId: "age",
      renderHeaderCell: () => "Age",
      renderCell: (r) => (
        <Badge appearance="tint" color={ageBadgeColor(r.age_hours)} title={`Requested ${formatDateTime(r.requested_at)}`}>
          {formatAge(r.age_hours)}
        </Badge>
      ),
    }),
    createTableColumn({ columnId: "adapter", renderHeaderCell: () => "Adapter", renderCell: (r) => r.adapter_key }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => (
        <Badge appearance="tint" color={r.status === "failed" ? "danger" : "warning"}>
          {r.status === "failed" ? `Failed (${r.attempts})` : "Pending"}
        </Badge>
      ),
    }),
    createTableColumn({
      columnId: "error",
      renderHeaderCell: () => "Last error",
      renderCell: (r) => <span className={admin.truncate} title={r.last_error ?? undefined}>{r.last_error ?? "—"}</span>,
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "Actions",
      renderCell: (r) => (
        <span className={admin.badges}>
          {busy === r.request_id && <Spinner size="tiny" />}
          <Button size="small" icon={<ArrowDownload20Regular />} onClick={() => void download(r)}>
            Download PDF to sign
          </Button>
          <Button
            size="small"
            icon={<ArrowUpload20Regular />}
            disabled={busy === r.request_id}
            onClick={() => {
              uploadTarget.current = r;
              fileInput.current?.click();
            }}
          >
            Upload signed PDF
          </Button>
          {r.status === "failed" && (
            <Button size="small" icon={<ArrowClockwise20Regular />} disabled={busy === r.request_id} onClick={() => retry.mutate(r)}>
              Retry
            </Button>
          )}
        </span>
      ),
    }),
  ];

  const resultEntries = Object.entries(results);

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          const row = uploadTarget.current;
          e.target.value = "";
          if (file && row) upload.mutate({ row, file });
        }}
      />
      <ErrorBar message={q.error ? errorMessage(q.error) : actionError} />
      {resultEntries.map(([id, res]) =>
        res.ok ? (
          <MessageBar key={id} intent="success" layout="multiline">
            <MessageBarBody>
              <MessageBarTitle>{res.label} signed.</MessageBarTitle>
              Signer: {res.result.verification.signer_subject ?? res.result.status.signer_subject ?? "unknown"}
              {" · "}Serial: {res.result.verification.signer_serial ?? res.result.status.signer_serial ?? "—"}
              {res.result.verification.signing_time && ` · Signed ${formatDateTime(res.result.verification.signing_time)}`}
              {res.result.verification.warnings.length > 0 && ` · ${res.result.verification.warnings.join("; ")}`}
            </MessageBarBody>
          </MessageBar>
        ) : (
          <MessageBar key={id} intent="error" layout="multiline" role="alert">
            <MessageBarBody>
              <MessageBarTitle>{res.label}: upload refused.</MessageBarTitle>
              {res.message}
            </MessageBarBody>
          </MessageBar>
        ),
      )}
      <div className={admin.surface}>
        {!q.data ? (
          <GridSkeleton />
        ) : q.data.length === 0 ? (
          <div className={admin.empty}>No documents are waiting for a signature.</div>
        ) : (
          <DataGrid items={q.data} columns={columns} getRowId={(r) => r.request_id} aria-label="Pending signatures" className={admin.grid}>
            <DataGridHeader>
              <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
            </DataGridHeader>
            <DataGridBody<DscPending>>
              {({ item, rowId }) => (
                <DataGridRow<DscPending> key={rowId}>{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}</DataGridRow>
              )}
            </DataGridBody>
          </DataGrid>
        )}
      </div>
    </>
  );
}
