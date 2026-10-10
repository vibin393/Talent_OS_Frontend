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
  makeStyles,
  type TableColumnDefinition,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminGrid } from "@/features/admin/admin-grid";
import { type PaymentSuggestionOut, ledgerApi, ledgerKeys } from "./api";
import { ConfirmDrawer } from "./confirm-drawer";
import { MATCH_NOTE_LABELS } from "./logic";

const useStyles = makeStyles({ row: { display: "flex", gap: tokens.spacingHorizontalXS, flexWrap: "wrap" } });

/** The "Payment suggestions" tab: payments pulled from Zoho Books, confirmed (★) or rejected. */
export function SuggestionsTab({ legalEntityId }: { legalEntityId: string | null }) {
  const styles = useStyles();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<PaymentSuggestionOut | null>(null);
  const [reject, setReject] = useState<PaymentSuggestionOut | null>(null);
  const q = useQuery({
    queryKey: ledgerKeys.suggestions("pending", legalEntityId ?? undefined),
    queryFn: ({ signal }) => ledgerApi.suggestions("pending", legalEntityId ?? undefined, signal),
  });

  const columns: TableColumnDefinition<PaymentSuggestionOut>[] = [
    createTableColumn({ columnId: "invoice", renderHeaderCell: () => "Invoice", renderCell: (r) => r.invoice_number }),
    createTableColumn({ columnId: "client", renderHeaderCell: () => "Client", renderCell: (r) => r.client_name ?? "—" }),
    createTableColumn({ columnId: "amount", renderHeaderCell: () => "Amount", renderCell: (r) => `${r.currency} ${r.amount}` }),
    createTableColumn({ columnId: "tds", renderHeaderCell: () => "TDS", renderCell: (r) => r.tds_amount ?? "—" }),
    createTableColumn({ columnId: "paid", renderHeaderCell: () => "Paid on", renderCell: (r) => r.paid_on }),
    createTableColumn({ columnId: "mode", renderHeaderCell: () => "Mode", renderCell: (r) => (r.mode ? r.mode.toUpperCase() : "—") }),
    createTableColumn({ columnId: "reference", renderHeaderCell: () => "Reference", renderCell: (r) => r.reference ?? "—" }),
    createTableColumn({
      columnId: "notes",
      renderHeaderCell: () => "Notes",
      renderCell: (r) => (r.match_note ? <Badge appearance="tint" color="warning">{MATCH_NOTE_LABELS[r.match_note] ?? r.match_note}</Badge> : "—"),
    }),
    createTableColumn({
      columnId: "actions",
      renderHeaderCell: () => "",
      renderCell: (r) => (
        <div className={styles.row}>
          <Button size="small" appearance="primary" onClick={() => setConfirm(r)}>
            Review and record
          </Button>
          <Button size="small" onClick={() => setReject(r)}>
            Reject
          </Button>
        </div>
      ),
    }),
  ];

  return (
    <>
      <AdminGrid
        items={q.data?.items}
        columns={columns}
        getRowId={(r) => r.id}
        loading={q.isPending}
        error={q.error}
        emptyText="No payment suggestions waiting."
        label="Payment suggestions"
      />
      {confirm ? <ConfirmDrawer suggestion={confirm} onClose={() => { setConfirm(null); void qc.invalidateQueries({ queryKey: ledgerKeys.all }); }} /> : null}
      {reject ? <RejectDialog suggestion={reject} onClose={() => setReject(null)} onDone={() => void qc.invalidateQueries({ queryKey: ledgerKeys.all })} /> : null}
    </>
  );
}

function RejectDialog({ suggestion, onClose, onDone }: { suggestion: PaymentSuggestionOut; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => ledgerApi.reject(suggestion.id, reason.trim()),
    onSuccess: () => {
      onDone();
      onClose();
    },
  });
  return (
    <Dialog open modalType="alert" onOpenChange={(_, d) => (!d.open ? onClose() : undefined)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Reject this suggestion?</DialogTitle>
          <DialogContent>
            <Field label="Reason" required>
              <Textarea maxLength={500} value={reason} onChange={(_, d) => setReason(d.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={reason.trim().length < 2 || m.isPending} onClick={() => m.mutate()}>
              Reject
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
