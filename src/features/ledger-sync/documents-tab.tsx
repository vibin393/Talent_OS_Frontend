"use client";

import {
  Badge,
  Button,
  createTableColumn,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  makeStyles,
  type TableColumnDefinition,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAppToast } from "@/components/toast";
import { AdminGrid } from "@/features/admin/admin-grid";
import { errorMessage } from "@/lib/api/errors";
import { newIdempotencyKey } from "@/features/receivables/logic";
import { type LedgerRecordOut, ledgerApi, ledgerKeys } from "./api";
import { DOC_KIND_LABELS, recordStatusBadge } from "./logic";

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  toolbar: { display: "flex", gap: tokens.spacingHorizontalS },
  row: { display: "flex", gap: tokens.spacingHorizontalXS, flexWrap: "wrap" },
});

/** The "Documents" tab: invoices, notes and payments with their sync status and a "Sync now" run. */
export function DocumentsTab({ legalEntityId, installationId }: { legalEntityId: string | null; installationId: string | null }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const toast = useAppToast();
  const [syncOpen, setSyncOpen] = useState(false);
  const [skip, setSkip] = useState<LedgerRecordOut | null>(null);
  const q = useQuery({
    queryKey: ledgerKeys.records({ legal_entity_id: legalEntityId }),
    queryFn: ({ signal }) => ledgerApi.records({ legal_entity_id: legalEntityId ?? undefined }, signal),
  });

  const retry = useMutation({
    mutationFn: (id: string) => ledgerApi.retry(id),
    onSuccess: () => {
      toast.success("Retry queued.");
      void qc.invalidateQueries({ queryKey: ledgerKeys.all });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const columns: TableColumnDefinition<LedgerRecordOut>[] = [
    createTableColumn({ columnId: "document", renderHeaderCell: () => "Document", renderCell: (r) => r.document_number ?? r.document_id.slice(0, 8) }),
    createTableColumn({ columnId: "type", renderHeaderCell: () => "Type", renderCell: (r) => DOC_KIND_LABELS[r.document_kind] ?? r.document_kind }),
    createTableColumn({ columnId: "date", renderHeaderCell: () => "Date", renderCell: (r) => r.doc_date }),
    createTableColumn({ columnId: "client", renderHeaderCell: () => "Client", renderCell: (r) => r.client_name ?? "—" }),
    createTableColumn({ columnId: "amount", renderHeaderCell: () => "Amount", renderCell: (r) => (r.amount ? `${r.currency ?? ""} ${r.amount}` : "—") }),
    createTableColumn({
      columnId: "status",
      renderHeaderCell: () => "Status",
      renderCell: (r) => {
        const b = recordStatusBadge(r.status);
        return <Badge appearance="tint" color={b.color}>{b.label}</Badge>;
      },
    }),
    createTableColumn({ columnId: "external", renderHeaderCell: () => "External ID", renderCell: (r) => r.external_number ?? r.external_ref ?? "—" }),
    createTableColumn({ columnId: "message", renderHeaderCell: () => "Message", renderCell: (r) => r.message ?? "—" }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (r) => (
        <div className={styles.row}>
          {r.status === "failed" || r.status === "pending" || r.status === "out_of_sync" ? (
            <Button size="small" onClick={() => retry.mutate(r.id)}>
              Retry
            </Button>
          ) : null}
          <Button size="small" onClick={() => setSkip(r)}>
            Skip
          </Button>
        </div>
      ),
    }),
  ];

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Button appearance="primary" disabled={!legalEntityId} onClick={() => setSyncOpen(true)}>
          Sync now
        </Button>
      </div>
      <AdminGrid items={q.data?.items} columns={columns} getRowId={(r) => r.id} loading={q.isPending} error={q.error} emptyText="No documents." label="Ledger documents" />
      {syncOpen && legalEntityId ? (
        <SyncNowDialog legalEntityId={legalEntityId} installationId={installationId} onClose={() => setSyncOpen(false)} onDone={() => void qc.invalidateQueries({ queryKey: ledgerKeys.all })} />
      ) : null}
      {skip ? <SkipDialog record={skip} onClose={() => setSkip(null)} onDone={() => void qc.invalidateQueries({ queryKey: ledgerKeys.all })} /> : null}
    </div>
  );
}

function SyncNowDialog({ legalEntityId, installationId, onClose, onDone }: { legalEntityId: string; installationId: string | null; onClose: () => void; onDone: () => void }) {
  const toast = useAppToast();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [key] = useState(newIdempotencyKey);
  const m = useMutation({
    mutationFn: () =>
      ledgerApi.createRun({ kind: "push", legal_entity_id: legalEntityId, installation_id: installationId ?? undefined, from_date: from || null, to_date: to || null }, key),
    onSuccess: () => {
      toast.success("Sync started.");
      onDone();
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(_, d) => (!d.open ? onClose() : undefined)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Sync documents</DialogTitle>
          <DialogContent>
            <Field label="From">
              <Input type="date" value={from} onChange={(_, d) => setFrom(d.value)} />
            </Field>
            <Field label="To">
              <Input type="date" value={to} onChange={(_, d) => setTo(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={m.isPending} onClick={() => m.mutate()}>
              Sync
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function SkipDialog({ record, onClose, onDone }: { record: LedgerRecordOut; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => ledgerApi.skip(record.id, reason.trim()),
    onSuccess: () => {
      onDone();
      onClose();
    },
  });
  return (
    <Dialog open modalType="alert" onOpenChange={(_, d) => (!d.open ? onClose() : undefined)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Skip this document?</DialogTitle>
          <DialogContent>
            <Field label="Reason" required>
              <Textarea maxLength={200} value={reason} onChange={(_, d) => setReason(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={reason.trim().length < 2 || m.isPending} onClick={() => m.mutate()}>
              Skip
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
