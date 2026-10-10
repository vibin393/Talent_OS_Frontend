"use client";

import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  OverlayDrawer,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Textarea,
} from "@fluentui/react-components";
import { Add20Regular, ArrowUndo20Regular, Dismiss24Regular } from "@fluentui/react-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ErrorBar, GridSkeleton, NoAccess } from "@/features/admin/ui";
import { hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import { errorMessage } from "@/lib/api/errors";
import { receivablesApi, receivablesKeys } from "./api";
import { Amount, ReceivablesTabs, StatusPill, useRcvStyles } from "./components";
import { newIdempotencyKey, todayIso } from "./logic";
import { RecordPaymentDrawer } from "./record-payment-drawer";
import type { PaymentOut } from "./types";

/** Payments list (`/receivables/payments`) with the Record Payment drawer and the payment detail drawer. */
export function PaymentsView() {
  const s = useRcvStyles();
  const perms = usePermissions();
  const [recording, setRecording] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const q = useQuery({
    queryKey: receivablesKeys.payments({ status }),
    queryFn: ({ signal }) => receivablesApi.payments({ status }, signal),
    enabled: hasAnyPermission(perms, ["receivables:read"]),
  });
  if (!hasAnyPermission(perms, ["receivables:read"])) return <NoAccess what="receivables" />;
  return (
    <div className={s.page}>
      <PageHeader title="Payments" subtitle="Cash application, allocations and reversals" />
      <ReceivablesTabs />
      <div className={s.row}>
        {hasAnyPermission(perms, ["payment:record"]) && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setRecording(true)}>
            Record payment
          </Button>
        )}
        <Checkbox
          label="Only unallocated"
          checked={status === "unallocated"}
          onChange={(_, d) => setStatus(d.checked ? "unallocated" : undefined)}
        />
      </div>
      <ErrorBar message={q.error ? errorMessage(q.error) : null} />
      {!q.data ? (
        <GridSkeleton />
      ) : q.data.length === 0 ? (
        <Text className={s.muted}>No payments yet.</Text>
      ) : (
        <div className={s.scroll}>
          <Table aria-label="Payments" size="small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Payment</TableHeaderCell>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Mode</TableHeaderCell>
                <TableHeaderCell>Reference</TableHeaderCell>
                <TableHeaderCell>Amount</TableHeaderCell>
                <TableHeaderCell>On account</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.map((p: PaymentOut) => (
                <TableRow key={p.id} onClick={() => setSelected(p.id)} style={{ cursor: "pointer" }}>
                  <TableCell>
                    <Button appearance="transparent" onClick={() => setSelected(p.id)}>
                      {p.human_id}
                    </Button>
                  </TableCell>
                  <TableCell>{p.payment_date}</TableCell>
                  <TableCell>{p.mode.toUpperCase()}</TableCell>
                  <TableCell>{p.reference ?? "-"}</TableCell>
                  <TableCell>
                    <Amount amount={p.amount} currency={p.currency} />
                  </TableCell>
                  <TableCell>
                    <Amount amount={p.unallocated} currency={p.currency} />
                  </TableCell>
                  <TableCell>
                    <StatusPill status={p.allocation_status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {recording && <RecordPaymentDrawer open onClose={() => setRecording(false)} />}
      {selected && <PaymentDetailDrawer id={selected} onClose={() => setSelected(null)} canReverse={hasAnyPermission(perms, ["payment:reverse"])} />}
    </div>
  );
}

function PaymentDetailDrawer({ id, onClose, canReverse }: { id: string; onClose: () => void; canReverse: boolean }) {
  const s = useRcvStyles();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: receivablesKeys.payment(id), queryFn: ({ signal }) => receivablesApi.payment(id, signal) });
  const [reversing, setReversing] = useState(false);
  const reverseAlloc = useMutation({
    mutationFn: (allocationId: string) => receivablesApi.reverseAllocation(allocationId, "Reversed from payment detail", newIdempotencyKey()),
    onSuccess: () => void qc.invalidateQueries({ queryKey: receivablesKeys.all }),
  });
  const p = q.data;
  return (
    <OverlayDrawer open onOpenChange={(_, d) => !d.open && onClose()} position="end" size="medium">
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" aria-label="Close" icon={<Dismiss24Regular />} onClick={onClose} />}>
          {p ? `Payment ${p.human_id}` : "Payment"}
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        {!p ? (
          <GridSkeleton rows={3} />
        ) : (
          <div className={s.stack}>
            <div className={s.row}>
              <StatusPill status={p.allocation_status} />
              <Amount amount={p.amount} currency={p.currency} strong />
              {p.currency !== "INR" && <Text className={s.muted}>INR {p.inr_amount} @ {p.fx_rate}</Text>}
              {p.prior_period && <StatusPill status="prior period" />}
            </div>
            {p.reversed_at && (
              <MessageBar intent="warning">
                <MessageBarBody>
                  Reversed on {p.reversal_date}: {p.reversal_reason}
                </MessageBarBody>
              </MessageBar>
            )}
            <Text weight="semibold">Allocations</Text>
            <div className={s.scroll}>
              <Table size="small" aria-label="Allocations">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Document</TableHeaderCell>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Amount</TableHeaderCell>
                    <TableHeaderCell>Realized FX</TableHeaderCell>
                    <TableHeaderCell />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.allocations.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.document_number ?? a.document_id.slice(0, 8)}</TableCell>
                      <TableCell>{a.allocation_date}</TableCell>
                      <TableCell>
                        <Amount amount={a.amount} currency={a.currency} />
                      </TableCell>
                      <TableCell>
                        <Amount amount={a.realized_fx} currency="INR" />
                      </TableCell>
                      <TableCell>
                        {a.reversed ? (
                          <StatusPill status="reversed" />
                        ) : (
                          canReverse && (
                            <Button size="small" icon={<ArrowUndo20Regular />} disabled={reverseAlloc.isPending} onClick={() => reverseAlloc.mutate(a.id)}>
                              Reverse
                            </Button>
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {p.tds.length > 0 && (
              <>
                <Text weight="semibold">TDS</Text>
                {p.tds.map((t) => (
                  <Text key={t.id}>
                    {t.kind === "gst_tds" ? "GST-TDS" : `TDS ${t.section_code ?? ""}`} {t.amount} (expected {t.expected_amount})
                    {t.variance_flag ? " - variance" : ""}
                  </Text>
                ))}
              </>
            )}
            <ErrorBar message={reverseAlloc.error ? errorMessage(reverseAlloc.error) : null} />
            {canReverse && !p.reversed_at && (
              <Button icon={<ArrowUndo20Regular />} onClick={() => setReversing(true)}>
                Reverse payment
              </Button>
            )}
          </div>
        )}
      </DrawerBody>
      {reversing && p && <ReverseDialog paymentId={p.id} onClose={() => setReversing(false)} />}
    </OverlayDrawer>
  );
}

/** ★ Reverse payment (bounced cheque): reason and date; reverses allocations and, optionally, TDS. */
function ReverseDialog({ paymentId, onClose }: { paymentId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [key] = useState(newIdempotencyKey);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(todayIso());
  const [reverseTds, setReverseTds] = useState(true);
  const m = useMutation({
    mutationFn: () => receivablesApi.reversePayment(paymentId, { reason: reason.trim(), reversal_date: date, reverse_tds: reverseTds }, key),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: receivablesKeys.all });
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Reverse payment</DialogTitle>
          <DialogContent>
            <Field label="Reason" required>
              <Textarea value={reason} onChange={(_, d) => setReason(d.value)} />
            </Field>
            <Field label="Reversal date" hint="Must fall in an open period">
              <Input type="date" value={date} onChange={(_, d) => setDate(d.value)} />
            </Field>
            <Checkbox label="Also reverse the TDS recorded with this payment" checked={reverseTds} onChange={(_, d) => setReverseTds(!!d.checked)} />
            <ErrorBar message={m.error ? errorMessage(m.error) : null} />
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" disabled={!reason.trim() || m.isPending} onClick={() => m.mutate()}>
              Reverse
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
