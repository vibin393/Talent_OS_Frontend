/** Pure billing UI logic (Epic 29): IRN validation, note caps, stale diffs, import preview summaries, labels. */
import { fromMinor, toMinor } from "./money";
import type {
  DocStatus,
  EinvoiceImportOut,
  EinvoiceStatus,
  ImportRowStatus,
  LineCap,
  StaleDiff,
} from "./types";

export const IRN_RE = /^[0-9a-f]{64}$/;

/** IRN: exactly 64 hexadecimal characters (case-insensitive); returns an error message or null. */
export function irnError(value: string): string | null {
  const v = value.trim();
  if (!v) return "The IRN is required";
  if (v.length !== 64)
    return `The IRN has ${v.length} characters; it must have 64`;
  if (!IRN_RE.test(v.toLowerCase()))
    return "The IRN may only contain 0-9 and a-f";
  return null;
}

export type CapCheck = {
  ok: boolean;
  taxable: string;
  exhausts: boolean;
  message: string | null;
};

/** Live cap of one credit-note line: the requested quantity (x effective rate) or amount vs what remains. */
export function checkCreditLine(
  cap: LineCap,
  input: { quantity?: string; amount?: string },
): CapCheck {
  let units: number | null = null;
  if (input.amount && input.amount.trim()) units = toMinor(input.amount);
  else if (input.quantity && input.quantity.trim()) {
    const q = toMinor(input.quantity, 2);
    const r = toMinor(cap.effective_rate, 4);
    if (q !== null && r !== null) {
      // q (2 dp) x r (4 dp) -> 6 dp; HALF_UP to 2 dp
      const product = q * r;
      units = Math.sign(product) * Math.round(Math.abs(product) / 10_000);
    }
  }
  if (units === null)
    return {
      ok: false,
      taxable: "0.00",
      exhausts: false,
      message: "Enter a quantity or an amount",
    };
  const remaining = toMinor(cap.remaining_taxable) ?? 0;
  if (units <= 0)
    return {
      ok: false,
      taxable: fromMinor(units),
      exhausts: false,
      message: "The credit must be positive",
    };
  if (units > remaining)
    return {
      ok: false,
      taxable: fromMinor(units),
      exhausts: false,
      message: `Only ${cap.remaining_taxable} remains on line ${cap.line_no}`,
    };
  return {
    ok: true,
    taxable: fromMinor(units),
    exhausts: units === remaining,
    message: null,
  };
}

/** Rows of the `draft_stale` diff dialog. */
export function staleRows(
  diff: StaleDiff | null | undefined,
): { field: string; from: string; to: string }[] {
  if (!diff) return [];
  const label: Record<string, string> = {
    document_total: "Document total",
    tax: "Tax",
    fx_rate: "Exchange rate",
    supply_type: "Supply type",
  };
  return Object.entries(diff).map(([k, v]) => ({
    field: label[k] ?? k,
    from: v.from == null ? "—" : String(v.from),
    to: v.to == null ? "—" : String(v.to),
  }));
}

export const IMPORT_STATUS_LABELS: Record<ImportRowStatus, string> = {
  matched: "Matched",
  unmatched: "Unmatched",
  already_registered: "Already registered",
  conflict: "Conflict",
  invalid: "Invalid",
};

/** Summary of an import preview: what Apply will do and whether it is allowed. */
export function importSummary(preview: EinvoiceImportOut | null | undefined): {
  canApply: boolean;
  text: string;
  duplicate: boolean;
} {
  if (!preview)
    return {
      canApply: false,
      text: "Upload the portal response file",
      duplicate: false,
    };
  const matched = preview.counts.matched ?? 0;
  const parts = (Object.keys(IMPORT_STATUS_LABELS) as ImportRowStatus[])
    .filter((k) => (preview.counts[k] ?? 0) > 0)
    .map(
      (k) => `${preview.counts[k]} ${IMPORT_STATUS_LABELS[k].toLowerCase()}`,
    );
  const duplicate = Boolean(preview.duplicate_of);
  return {
    canApply: matched > 0 && preview.status === "previewed",
    text: parts.length ? parts.join(", ") : "No rows found",
    duplicate,
  };
}

export const STATUS_LABELS: Record<DocStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  issued: "Issued",
  discarded: "Discarded",
  cancelled: "Cancelled",
};

export function statusColor(
  status: DocStatus,
): "informative" | "warning" | "success" | "subtle" | "danger" {
  return (
    {
      draft: "informative",
      pending_approval: "warning",
      issued: "success",
      discarded: "subtle",
      cancelled: "danger",
    } as const
  )[status];
}

export const EINVOICE_LABELS: Record<EinvoiceStatus, string> = {
  not_applicable: "Not applicable",
  pending_irn: "Pending IRN",
  irn_registered: "IRN registered",
  irn_cancelled: "IRN cancelled",
};

/** Hours since issue for the pending-IRN queue; `warn` after 24 h. */
export function irnAge(
  issuedAt: string | null,
  now: Date = new Date(),
): { hours: number; warn: boolean } {
  if (!issuedAt) return { hours: 0, warn: false };
  const hours = Math.max(
    0,
    Math.floor((now.getTime() - new Date(issuedAt).getTime()) / 3_600_000),
  );
  return { hours, warn: hours >= 24 };
}

/** Countdown text to the IRN-cancel deadline (24 h after Ack). */
export function cancelCountdown(
  deadline: string | null | undefined,
  now: Date = new Date(),
): { open: boolean; text: string } {
  if (!deadline) return { open: false, text: "No acknowledgement" };
  const ms = new Date(deadline).getTime() - now.getTime();
  if (ms <= 0) return { open: false, text: "Cancellation window closed" };
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return { open: true, text: `${h} h ${m} min left to cancel` };
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function billingErrorMessage(
  code: string | undefined,
  fallback: string,
): string {
  const messages: Record<string, string> = {
    draft_stale:
      "Rates, FX or tax changed since approval. Recompute the draft and review it again.",
    pending_irn: "Record the IRN before sending this document.",
    period_closed: "The accounting period of this date is closed.",
    po_insufficient: "The purchase order does not have enough balance.",
    credit_exceeds_original:
      "The credit is more than what remains on the original invoice.",
    cn_gst_deadline_passed:
      "The GST deadline for credit notes on this invoice has passed. Issue a commercial credit instead.",
    irn_cancel_window_closed:
      "IRNs can only be cancelled within 24 hours of acknowledgement.",
    run_in_progress:
      "An invoice run is already building for this GST registration.",
    doc_date_out_of_order:
      "The date is before the last issued invoice of this series.",
    dsc_pending:
      "This document is waiting for its DSC signature. Sign it under Finance > DSC signing before sending.",
  };
  return (code && messages[code]) || fallback;
}
