"use client";

import {
  Badge,
  Button,
  MessageBar,
  MessageBarBody,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@fluentui/react-components";
import {
  ArrowDownload20Regular,
  ArrowUpload20Regular,
} from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
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
import { billingApi, billingKeys } from "./api";
import { IrnDialog, Money, useBillingStyles } from "./components";
import {
  IMPORT_STATUS_LABELS,
  importSummary,
  irnAge,
  newIdempotencyKey,
} from "./logic";
import type { DocSummaryOut, EinvoiceImportOut } from "./types";

/** `/billing/einvoice`: pending-IRN queue, bulk JSON download, portal response import and manual IRN entry. */
export function EinvoiceView() {
  const admin = useAdminStyles();
  const s = useBillingStyles();
  const perms = usePermissions();
  const qc = useQueryClient();
  const canWrite = hasAnyPermission(perms, ["einvoice:write"]);
  const pending = useQuery({
    queryKey: billingKeys.pendingIrn,
    queryFn: ({ signal }) => billingApi.pendingIrn(signal),
    enabled: canWrite,
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<EinvoiceImportOut | null>(null);
  const [irnFor, setIrnFor] = useState<DocSummaryOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: (file: File) => billingApi.importResponse(file),
    onSuccess: setPreview,
    onError: (e) => setError(errorMessage(e)),
  });
  const apply = useMutation({
    mutationFn: (batchId: string) =>
      billingApi.applyImport(batchId, newIdempotencyKey()),
    onSuccess: () => {
      setPreview(null);
      void qc.invalidateQueries({ queryKey: billingKeys.all });
    },
    onError: (e) => setError(errorMessage(e)),
  });
  if (!canWrite) return <NoAccess what="e-invoices" />;
  const summary = importSummary(preview);
  return (
    <>
      <PageHeader
        title="E-invoicing"
        subtitle="Register pending documents on the IRP portal and record their IRNs"
      />
      {error && <ErrorBar message={error} />}
      <div className={admin.toolbar}>
        <Button
          as="a"
          href={billingApi.exportUrl()}
          icon={<ArrowDownload20Regular />}
          disabled={!pending.data?.length}
        >
          Download JSON for the IRP
        </Button>
        <Button
          icon={<ArrowUpload20Regular />}
          onClick={() => fileRef.current?.click()}
        >
          Upload portal response
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate(file);
            e.target.value = "";
          }}
        />
      </div>
      {preview && (
        <div className={s.card} style={{ marginBottom: 16 }}>
          <MessageBar intent={summary.duplicate ? "warning" : "info"}>
            <MessageBarBody>
              {summary.duplicate
                ? `This file was applied before. ${summary.text}.`
                : summary.text}
            </MessageBarBody>
          </MessageBar>
          <Table size="small" aria-label="Import preview">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Document</TableHeaderCell>
                <TableHeaderCell>Ack</TableHeaderCell>
                <TableHeaderCell>Result</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.map((r, i) => (
                <TableRow key={`${r.number}-${i}`}>
                  <TableCell>{`${r.doc_type ?? ""} ${r.number ?? "—"}`}</TableCell>
                  <TableCell>{r.ack_no ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      appearance="tint"
                      color={
                        r.status === "matched"
                          ? "success"
                          : r.status === "already_registered"
                            ? "informative"
                            : "warning"
                      }
                    >
                      {IMPORT_STATUS_LABELS[r.status]}
                    </Badge>
                    {r.message ? ` ${r.message}` : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className={admin.footer}>
            <Button onClick={() => setPreview(null)}>Discard</Button>
            <Button
              appearance="primary"
              disabled={!summary.canApply || apply.isPending}
              onClick={() => apply.mutate(preview.batch_id)}
            >
              {`Apply ${preview.counts.matched ?? 0} IRNs`}
            </Button>
          </div>
        </div>
      )}
      <div className={admin.surface}>
        {!pending.data ? (
          pending.error ? (
            <ErrorBar message={errorMessage(pending.error)} />
          ) : (
            <GridSkeleton />
          )
        ) : pending.data.length === 0 ? (
          <div className={admin.empty}>
            No documents are waiting for an IRN.
          </div>
        ) : (
          <Table aria-label="Pending IRN">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Document</TableHeaderCell>
                <TableHeaderCell>Client</TableHeaderCell>
                <TableHeaderCell>Total</TableHeaderCell>
                <TableHeaderCell>Age</TableHeaderCell>
                <TableHeaderCell />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.data.map((d) => {
                const age = irnAge(
                  d.doc_date ? `${d.doc_date}T00:00:00` : null,
                );
                return (
                  <TableRow key={d.id}>
                    <TableCell>{`${d.kind.replace("_", " ")} ${d.number}`}</TableCell>
                    <TableCell>{d.client_name ?? "—"}</TableCell>
                    <TableCell>
                      <Money amount={d.document_total} currency={d.currency} />
                    </TableCell>
                    <TableCell>
                      <Badge
                        appearance="tint"
                        color={age.warn ? "danger" : "informative"}
                      >{`${age.hours} h`}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => setIrnFor(d)}>
                        Record IRN
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
      <IrnDialog
        open={irnFor !== null}
        onClose={() => setIrnFor(null)}
        onSubmit={async (body) => {
          if (!irnFor) return;
          await billingApi.recordIrn(
            irnFor.kind,
            irnFor.id,
            body,
            newIdempotencyKey(),
          );
          void qc.invalidateQueries({ queryKey: billingKeys.all });
        }}
      />
    </>
  );
}
