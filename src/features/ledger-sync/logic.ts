/**
 * Ledger sync pure logic and labels (Epic 71): document-kind and status labels, status badge colours, reconciliation
 * flag labels, the fixed GST-output rows, and building a PaymentIn from a suggestion's prefill. Used by UI + vitest.
 */
import type { PaymentIn, PaymentMode } from "@/features/receivables/types";
import type { PaymentSuggestionOut } from "./api";

export type BadgeColor = "success" | "warning" | "danger" | "informative" | "subtle";

export const DOC_KIND_LABELS: Record<string, string> = {
  invoice: "Invoice",
  credit_note: "Credit note",
  debit_note: "Debit note",
  payment: "Payment",
};

export const RECORD_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  synced: "Synced",
  failed: "Failed",
  skipped: "Skipped",
  out_of_sync: "Out of sync",
  blocked_period: "Blocked: period closed",
};

const RECORD_STATUS_COLOR: Record<string, BadgeColor> = {
  pending: "informative",
  synced: "success",
  failed: "danger",
  skipped: "subtle",
  out_of_sync: "warning",
  blocked_period: "warning",
};

export function recordStatusBadge(status: string): { label: string; color: BadgeColor } {
  return { label: RECORD_STATUS_LABELS[status] ?? status, color: RECORD_STATUS_COLOR[status] ?? "informative" };
}

export const MATCH_NOTE_LABELS: Record<string, string> = {
  invoice_not_found: "Invoice not found",
  currency_mismatch: "Currency differs",
  over_payment: "More than the balance",
};

export const RECON_FLAG_LABELS: { key: string; label: string }[] = [
  { key: "amount_differs", label: "Amount differs" },
  { key: "status_differs", label: "Status differs" },
  { key: "only_in_talent_os", label: "Only in Talent OS" },
  { key: "only_in_ledger", label: "Only in ledger" },
];

export function reconFlagLabels(flags: string[]): string {
  return flags.map((f) => RECON_FLAG_LABELS.find((x) => x.key === f)?.label ?? f).join(", ");
}

/** The fixed GST output ledger rows shown under "GST output ledgers" (spec B Ledger mapping). */
export const GST_OUTPUT_ROWS: { key: string; label: string }[] = [
  { key: "cgst:2.5", label: "CGST 2.5%" },
  { key: "sgst:2.5", label: "SGST 2.5%" },
  { key: "cgst:6", label: "CGST 6%" },
  { key: "sgst:6", label: "SGST 6%" },
  { key: "cgst:9", label: "CGST 9%" },
  { key: "sgst:9", label: "SGST 9%" },
  { key: "cgst:14", label: "CGST 14%" },
  { key: "sgst:14", label: "SGST 14%" },
  { key: "igst:5", label: "IGST 5%" },
  { key: "igst:12", label: "IGST 12%" },
  { key: "igst:18", label: "IGST 18%" },
  { key: "igst:28", label: "IGST 28%" },
];

const MODES: PaymentMode[] = ["neft", "rtgs", "imps", "upi", "cheque", "wire"];

function asMode(v: unknown): PaymentMode {
  return typeof v === "string" && (MODES as string[]).includes(v) ? (v as PaymentMode) : "neft";
}

/**
 * Build the PaymentIn the confirm drawer submits, from the suggestion's `prefill` (server-computed: client, date,
 * amount, currency, mode, reference, allocation to the matched invoice, TDS) merged with the user's edits.
 */
export function prefillToPayment(s: PaymentSuggestionOut, edits: Partial<PaymentIn> = {}): PaymentIn {
  const pf = (s.prefill ?? {}) as Record<string, unknown>;
  const base: PaymentIn = {
    legal_entity_id: (pf.legal_entity_id as string) ?? s.legal_entity_id,
    client_id: (pf.client_id as string) ?? s.client_id ?? "",
    payment_date: (pf.payment_date as string) ?? s.paid_on,
    amount: (pf.amount as string) ?? s.amount,
    currency: (pf.currency as string) ?? s.currency,
    fx_rate: (pf.fx_rate as string | null) ?? null,
    mode: asMode(pf.mode ?? s.mode),
    reference: (pf.reference as string | null) ?? s.reference ?? null,
    receiving_bank_account_id: (pf.receiving_bank_account_id as string | null) ?? null,
    allocations: (pf.allocations as PaymentIn["allocations"]) ?? "auto",
    tds: (pf.tds as PaymentIn["tds"]) ?? [],
  };
  return { ...base, ...edits };
}
