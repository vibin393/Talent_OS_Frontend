"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  Link,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Textarea,
} from "@fluentui/react-components";
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
import { errorMessage, isApiError } from "@/lib/api/errors";
import { pdfUrl } from "./api";
import {
  EinvoiceBadge,
  IrnDialog,
  Money,
  StaleDiffDialog,
  StatusBadge,
  useBillingStyles,
} from "./components";
import {
  billingErrorMessage,
  cancelCountdown,
  checkCreditLine,
  newIdempotencyKey,
} from "./logic";
import { DscStatusBadge } from "./dsc/dsc-status-badge";
import type { DocDetailOut, DocKind, StaleDiff } from "./types";
import {
  useBillingDoc,
  useCreateNote,
  useInvoiceNotes,
  useNoteCaps,
} from "./use-invoices";

const TITLE: Record<DocKind, string> = {
  invoice: "Invoice",
  credit_note: "Credit note",
  debit_note: "Debit note",
};

/** `/billing/invoices/[id]` (and credit / debit notes): header, lines, tax breakdown, words, PDF and actions. */
export function BillingDocDetail({ kind, id }: { kind: DocKind; id: string }) {
  const admin = useAdminStyles();
  const s = useBillingStyles();
  const perms = usePermissions();
  const doc = useBillingDoc(kind, id);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState<StaleDiff | null>(null);
  const [irnOpen, setIrnOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [noteKind, setNoteKind] = useState<"credit_note" | "debit_note" | null>(
    null,
  );
  const [issueKey, setIssueKey] = useState(newIdempotencyKey);
  const [pdfVersion, setPdfVersion] = useState(0);
  if (!hasAnyPermission(perms, ["billing:read", "billing:write"]))
    return <NoAccess what="invoices" />;
  const d = doc.query.data;
  if (!d)
    return doc.query.error ? (
      <ErrorBar message={errorMessage(doc.query.error)} />
    ) : (
      <GridSkeleton />
    );
  const can = (p: string) => hasAnyPermission(perms, [p]);
  const editable = d.status === "draft" || d.status === "pending_approval";
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      setPdfVersion((v) => v + 1);
    } catch (e) {
      if (isApiError(e) && e.code === "draft_stale")
        setStale((e.details?.diff as StaleDiff) ?? {});
      else
        setError(
          billingErrorMessage(
            isApiError(e) ? e.code : undefined,
            errorMessage(e),
          ),
        );
    }
  };
  const countdown = cancelCountdown(d.irn_cancel_deadline);
  return (
    <>
      <PageHeader
        title={`${TITLE[kind]} ${d.number ?? "(draft)"}`}
        subtitle={d.client_name ?? undefined}
      />
      {error && <ErrorBar message={error} />}
      {d.stale && (
        <MessageBar intent="warning">
          <MessageBarBody>
            A rate segment changed after this draft was built. Recompute it
            before issuing.
          </MessageBarBody>
        </MessageBar>
      )}
      {d.warnings.includes("lut_missing") && (
        <MessageBar intent="warning">
          <MessageBarBody>
            No valid LUT for this financial year: IGST is charged on this
            export.
          </MessageBarBody>
        </MessageBar>
      )}
      <div className={s.row} style={{ margin: "12px 0" }}>
        {kind === "invoice" && d.status === "draft" && can("billing:write") && (
          <Button onClick={() => run(() => doc.submit.mutateAsync(undefined))}>
            Submit for approval
          </Button>
        )}
        {editable && can("invoice:issue") && (
          <Button
            appearance="primary"
            onClick={() =>
              run(async () => {
                await doc.issue.mutateAsync({ key: issueKey });
                setIssueKey(newIdempotencyKey());
              })
            }
          >
            Issue
          </Button>
        )}
        {kind === "invoice" && editable && can("billing:write") && (
          <Button
            onClick={() => run(() => doc.recompute.mutateAsync(undefined))}
          >
            Recompute
          </Button>
        )}
        {editable && can("billing:write") && (
          <Button onClick={() => run(() => doc.discard.mutateAsync(undefined))}>
            Discard
          </Button>
        )}
        {d.status === "issued" && can("billing:write") && (
          <Button
            disabled={d.einvoice_status === "pending_irn"}
            onClick={() => run(() => doc.send.mutateAsync([]))}
          >
            Send
          </Button>
        )}
        <Button as="a" href={pdfUrl(kind, id)} target="_blank">
          Download PDF
        </Button>
        {kind === "invoice" &&
          d.status === "issued" &&
          can("credit_note:write") && (
            <>
              <Button onClick={() => setNoteKind("credit_note")}>
                Create credit note
              </Button>
              <Button onClick={() => setNoteKind("debit_note")}>
                Create debit note
              </Button>
            </>
          )}
        {d.status === "issued" &&
          d.einvoice_status === "pending_irn" &&
          can("einvoice:write") && (
            <Button onClick={() => setIrnOpen(true)}>Record IRN</Button>
          )}
        {kind === "invoice" &&
          d.einvoice_status === "irn_registered" &&
          d.status === "issued" &&
          can("einvoice:write") && (
            <Button
              disabled={!countdown.open}
              onClick={() => setCancelOpen(true)}
              title={countdown.text}
            >
              {`Cancel IRN (${countdown.text})`}
            </Button>
          )}
      </div>
      <div className={s.grid2}>
        <div className={s.card}>
          <div className={admin.badges}>
            <StatusBadge status={d.status} />
            <EinvoiceBadge status={d.einvoice_status} />
            <DscStatusBadge status={d.dsc_status} />
          </div>
          <dl className={admin.detailList}>
            <dt>Date</dt>
            <dd>{d.doc_date ?? `${d.preview_date ?? "—"} (preview)`}</dd>
            <dt>Due</dt>
            <dd>{d.due_date ?? "—"}</dd>
            <dt>Supply</dt>
            <dd>{`${d.supply_type ?? "—"} · place of supply ${d.pos_state_code ?? "—"}${d.reverse_charge ? " · reverse charge" : ""}`}</dd>
            {d.lut_ref && (
              <>
                <dt>LUT</dt>
                <dd>{d.lut_ref}</dd>
              </>
            )}
            {d.currency !== "INR" && (
              <>
                <dt>Exchange rate</dt>
                <dd>{`${d.fx_rate} (${d.fx_source}, ${d.fx_rate_date})`}</dd>
              </>
            )}
            {d.irn && (
              <>
                <dt>IRN</dt>
                <dd className={s.mono}>{d.irn}</dd>
                <dt>Ack</dt>
                <dd>{`${d.ack_no} · ${d.ack_at}`}</dd>
              </>
            )}
            {d.cancel_basis && (
              <>
                <dt>Cancelled</dt>
                <dd>{d.cancel_basis.replace("_", " ")}</dd>
              </>
            )}
          </dl>
        </div>
        <div className={s.card}>
          <Table aria-label="Totals" size="small">
            <TableBody>
              <TableRow>
                <TableCell>Taxable value</TableCell>
                <TableCell>
                  <Money amount={d.taxable_total} currency={d.currency} />
                </TableCell>
              </TableRow>
              {d.outside_taxable_total !== "0.00" && (
                <TableRow>
                  <TableCell>Reimbursements (pure agent)</TableCell>
                  <TableCell>
                    <Money
                      amount={d.outside_taxable_total}
                      currency={d.currency}
                    />
                  </TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell>
                  {d.reverse_charge ? "Tax (payable by recipient)" : "Tax"}
                </TableCell>
                <TableCell>
                  <Money
                    amount={
                      d.reverse_charge ? d.rcm_tax_total : d.charged_tax_total
                    }
                    currency={d.currency}
                  />
                </TableCell>
              </TableRow>
              {d.round_off !== "0.00" && (
                <TableRow>
                  <TableCell>Round off</TableCell>
                  <TableCell>
                    <Money amount={d.round_off} currency={d.currency} />
                  </TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell>
                  <strong>Total</strong>
                </TableCell>
                <TableCell>
                  <Money
                    amount={d.document_total}
                    currency={d.currency}
                    strong
                  />
                </TableCell>
              </TableRow>
              {d.currency !== "INR" && (
                <TableRow>
                  <TableCell>INR equivalent</TableCell>
                  <TableCell>
                    <Money amount={d.inr_document_total} currency="INR" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Text size={200}>{d.amount_in_words}</Text>
        </div>
      </div>
      <LinesTable
        doc={d}
        canRemove={kind === "invoice" && editable && can("billing:write")}
        onRemove={(lineId) => run(() => doc.removeLine.mutateAsync(lineId))}
      />
      {kind === "invoice" && d.status !== "draft" && (
        <NotesList invoiceId={id} />
      )}
      <h3>Preview</h3>
      <iframe
        key={pdfVersion}
        title="Invoice PDF preview"
        src={pdfUrl(kind, id)}
        className={s.pdf}
      />
      <StaleDiffDialog
        diff={stale}
        onClose={() => setStale(null)}
        onRecompute={() => doc.recompute.mutateAsync(undefined)}
      />
      <IrnDialog
        open={irnOpen}
        onClose={() => setIrnOpen(false)}
        onSubmit={(body) =>
          doc.recordIrn.mutateAsync({ body, key: newIdempotencyKey() })
        }
      />
      {cancelOpen && (
        <CancelIrnDialog
          onClose={() => setCancelOpen(false)}
          onSubmit={(reason) =>
            doc.cancelIrn.mutateAsync({ reason, key: newIdempotencyKey() })
          }
        />
      )}
      {noteKind && (
        <NoteEditor
          kind={noteKind}
          invoice={d}
          onClose={() => setNoteKind(null)}
        />
      )}
    </>
  );
}

function LinesTable({
  doc,
  canRemove,
  onRemove,
}: {
  doc: DocDetailOut;
  canRemove: boolean;
  onRemove: (lineId: string) => void;
}) {
  const admin = useAdminStyles();
  return (
    <div className={admin.surface} style={{ marginTop: 16 }}>
      <Table aria-label="Lines" size="small">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>#</TableHeaderCell>
            <TableHeaderCell>Description</TableHeaderCell>
            <TableHeaderCell>SAC</TableHeaderCell>
            <TableHeaderCell>Qty</TableHeaderCell>
            <TableHeaderCell>Rate</TableHeaderCell>
            <TableHeaderCell>Taxable</TableHeaderCell>
            <TableHeaderCell>Tax</TableHeaderCell>
            <TableHeaderCell />
          </TableRow>
        </TableHeader>
        <TableBody>
          {doc.lines.map((l) => (
            <TableRow key={l.id}>
              <TableCell>{l.line_no}</TableCell>
              <TableCell>{l.description}</TableCell>
              <TableCell>{l.sac_code}</TableCell>
              <TableCell>{`${l.quantity} ${l.unit}`}</TableCell>
              <TableCell>{l.effective_rate}</TableCell>
              <TableCell>
                <Money amount={l.taxable_value} currency={doc.currency} />
              </TableCell>
              <TableCell>
                {l.outside_taxable_value
                  ? "Pure agent"
                  : l.taxes
                      .map(
                        (t) =>
                          `${t.component.toUpperCase()} ${t.rate_pct}% ${t.amount}`,
                      )
                      .join(", ") || "—"}
              </TableCell>
              <TableCell>
                {canRemove && (
                  <Button size="small" onClick={() => onRemove(l.id)}>
                    Remove
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function NotesList({ invoiceId }: { invoiceId: string }) {
  const { credit, debit } = useInvoiceNotes(invoiceId);
  const rows = [...(credit.data ?? []), ...(debit.data ?? [])];
  if (!rows.length) return null;
  return (
    <>
      <h3>Credit and debit notes</h3>
      <ul>
        {rows.map((n) => (
          <li key={n.id}>
            <Link
              as="a"
              href={`/billing/${n.kind === "credit_note" ? "credit-notes" : "debit-notes"}/${n.id}`}
            >
              {`${n.kind === "credit_note" ? "Credit note" : "Debit note"} ${n.number ?? "(draft)"}`}
            </Link>{" "}
            <Money amount={n.document_total} currency={n.currency} /> ·{" "}
            {n.status}
          </li>
        ))}
      </ul>
    </>
  );
}

function CancelIrnDialog({
  onSubmit,
  onClose,
}: {
  onSubmit: (reason: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open
      modalType="alert"
      onOpenChange={(_, d) => !d.open && onClose()}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Cancel IRN</DialogTitle>
          <DialogContent>
            {error && <ErrorBar message={error} />}
            <p>
              The invoice is cancelled on the IRP and here; its number stays
              used and its hours become billable again.
            </p>
            <Field label="Reason" required>
              <Textarea
                value={reason}
                onChange={(_, d) => setReason(d.value)}
              />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Keep invoice</Button>
            <Button
              appearance="primary"
              disabled={reason.trim().length < 3}
              onClick={async () => {
                try {
                  await onSubmit(reason.trim());
                  onClose();
                } catch (e) {
                  setError(
                    billingErrorMessage(
                      isApiError(e) ? e.code : undefined,
                      errorMessage(e),
                    ),
                  );
                }
              }}
            >
              Cancel IRN
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

const CN_REASONS = [
  ["discount", "Discount"],
  ["commercial", "Commercial adjustment"],
  ["other", "Other"],
  ["cancellation", "Cancellation (full)"],
] as const;

/** Credit / Debit Note editor with live caps per line, rebill toggle and the GST deadline warning. */
function NoteEditor({
  kind,
  invoice,
  onClose,
}: {
  kind: "credit_note" | "debit_note";
  invoice: DocDetailOut;
  onClose: () => void;
}) {
  const s = useBillingStyles();
  const caps = useNoteCaps(invoice.id, true);
  const { credit, debit } = useCreateNote(invoice.id);
  const router = useRouter();
  const [reason, setReason] = useState<string>(
    kind === "credit_note" ? "discount" : "commercial",
  );
  const [rebill, setRebill] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const full = kind === "credit_note" && reason === "cancellation";
  const noRebill = reason === "discount" || reason === "commercial";
  const lines = caps.data?.lines ?? [];
  const checks = lines.map((c) => ({
    cap: c,
    check: amounts[c.line_id]
      ? checkCreditLine(c, { amount: amounts[c.line_id] })
      : null,
  }));
  const chosen = checks.filter((x) => x.check);
  const valid =
    full ||
    (chosen.length > 0 &&
      (kind === "debit_note" || chosen.every((x) => x.check?.ok)));
  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface style={{ maxWidth: 820 }}>
        <DialogBody>
          <DialogTitle>
            {kind === "credit_note"
              ? "Create credit note"
              : "Create debit note"}
          </DialogTitle>
          <DialogContent className={s.stack}>
            {error && <ErrorBar message={error} />}
            {caps.data?.deadline_passed && kind === "credit_note" && (
              <MessageBar intent="warning">
                <MessageBarBody>{`The GST credit-note deadline (${caps.data.gst_deadline}) has passed for this invoice; only a commercial credit can be issued.`}</MessageBarBody>
              </MessageBar>
            )}
            <Field label="Reason">
              <Dropdown
                value={
                  (kind === "credit_note"
                    ? CN_REASONS
                    : CN_REASONS.slice(1, 3)
                  ).find((r) => r[0] === reason)?.[1] ?? reason
                }
                selectedOptions={[reason]}
                onOptionSelect={(_, d) => setReason(d.optionValue ?? reason)}
              >
                {(kind === "credit_note"
                  ? CN_REASONS
                  : CN_REASONS.slice(1, 3)
                ).map(([v, l]) => (
                  <Option key={v} value={v}>
                    {l}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            {kind === "credit_note" && (
              <Switch
                label="Release the hours for re-billing"
                checked={rebill && !noRebill}
                disabled={noRebill || !full}
                onChange={(_, d) => setRebill(d.checked)}
              />
            )}
            {!full &&
              (caps.data ? (
                <Table size="small" aria-label="Lines to credit">
                  <TableHeader>
                    <TableRow>
                      <TableHeaderCell>Line</TableHeaderCell>
                      <TableHeaderCell>Remaining</TableHeaderCell>
                      <TableHeaderCell>Amount</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checks.map(({ cap, check }) => (
                      <TableRow key={cap.line_id}>
                        <TableCell>{`${cap.line_no}. ${cap.description}`}</TableCell>
                        <TableCell>
                          <Money
                            amount={cap.remaining_taxable}
                            currency={invoice.currency}
                          />
                          {cap.components
                            .map(
                              (c) =>
                                ` · ${c.component.toUpperCase()} ${c.remaining}`,
                            )
                            .join("")}
                        </TableCell>
                        <TableCell>
                          <Field
                            validationState={
                              check && !check.ok && kind === "credit_note"
                                ? "error"
                                : "none"
                            }
                            validationMessage={
                              kind === "credit_note"
                                ? (check?.message ??
                                  (check?.exhausts
                                    ? "Takes the remaining tax"
                                    : undefined))
                                : undefined
                            }
                          >
                            <Input
                              value={amounts[cap.line_id] ?? ""}
                              onChange={(_, d) =>
                                setAmounts((a) => ({
                                  ...a,
                                  [cap.line_id]: d.value,
                                }))
                              }
                              inputMode="decimal"
                            />
                          </Field>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Spinner />
              ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              appearance="primary"
              disabled={!valid}
              onClick={async () => {
                setError(null);
                const picked = chosen.map((x) => ({
                  original_invoice_line_id: x.cap.line_id,
                  amount: amounts[x.cap.line_id],
                }));
                try {
                  const note =
                    kind === "credit_note"
                      ? await credit.mutateAsync(
                          full
                            ? {
                                reason: "cancellation",
                                full: true,
                                rebill: rebill && !noRebill,
                              }
                            : { reason: reason as "discount", lines: picked },
                        )
                      : await debit.mutateAsync({
                          reason: reason as "commercial",
                          lines: picked,
                        });
                  router.push(
                    `/billing/${kind === "credit_note" ? "credit-notes" : "debit-notes"}/${note.id}`,
                  );
                } catch (e) {
                  setError(
                    billingErrorMessage(
                      isApiError(e) ? e.code : undefined,
                      errorMessage(e),
                    ),
                  );
                }
              }}
            >
              Create draft
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
