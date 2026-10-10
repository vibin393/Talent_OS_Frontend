/** Pure helpers of the Expenses UI (Epic 27): labels, colors, justification / decision rules, AI suggestion labelling. */
import { isApiError } from "@/lib/api/errors";
import { formatMoney } from "./money";
import type {
  ClaimStatus,
  DecideIn,
  Decision,
  ExpenseCategory,
  LineIn,
  LinePreviewOut,
  PolicyCategory,
  ReceiptSuggestion,
  WorkerLine,
} from "./types";
import { EXPENSE_CATEGORIES } from "./types";

export type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";

export const STATUS_LABELS: Record<ClaimStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  in_approval: "In approval",
  approved: "Approved",
  partially_approved: "Partially approved",
  rejected: "Rejected",
  reimbursed: "Reimbursed",
  stated: "Stated",
};

const STATUS_COLORS: Record<ClaimStatus, BadgeColor> = {
  draft: "subtle",
  submitted: "informative",
  in_approval: "brand",
  approved: "success",
  partially_approved: "warning",
  rejected: "danger",
  reimbursed: "success",
  stated: "success",
};

export const statusLabel = (s: string) => STATUS_LABELS[s as ClaimStatus] ?? s;
export const statusColor = (s: string): BadgeColor => STATUS_COLORS[s as ClaimStatus] ?? "subtle";

export const LINE_STATUS_LABELS: Record<string, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected" };
export const lineStatusColor = (s: string): BadgeColor => (s === "approved" ? "success" : s === "rejected" ? "danger" : "subtle");

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  travel: "Travel",
  accommodation: "Accommodation",
  meals: "Meals",
  mileage: "Mileage",
  equipment: "Equipment",
  other: "Other",
};
export const categoryLabel = (c: string) => CATEGORY_LABELS[c as ExpenseCategory] ?? c;

export const FLAG_LABELS: Record<string, string> = {
  over_daily_limit: "Over daily limit",
  over_claim_limit: "Over claim limit",
  receipt_missing: "Receipt missing",
  possible_duplicate_receipt: "Possible duplicate receipt",
  category_disabled: "Category not allowed",
};
export const flagLabel = (f: string) => FLAG_LABELS[f] ?? f;

export const REBILL_LABELS: Record<string, string> = { at_cost: "At cost", markup: "Markup", not_billable: "Not billable" };
export const TAX_MODE_LABELS: Record<string, string> = { taxable: "Taxable", pure_agent: "Pure agent" };

const CODE_LABELS: Record<string, string> = {
  justification_required: "Add a justification to every flagged expense before submitting.",
  category_disabled: "One of the categories is not allowed by the expense policy.",
  claim_empty: "Add at least one expense before submitting.",
  receipt_infected: "The receipt failed the virus scan and was not attached.",
  receipt_too_large: "The receipt file is too large.",
  receipt_type_unsupported: "This file type is not supported. Use a photo (JPEG, PNG, HEIC) or a PDF.",
  fx_rate_missing: "No exchange rate is available for this currency on that date. Ask Finance to add one.",
  currency_unsupported: "This currency is not supported.",
  placement_not_claimable: "This placement can no longer receive expense claims.",
  claim_locked: "This claim has been posted to payroll or billing and can no longer be reopened.",
  policy_exists: "A policy already exists for this scope. Save a new version instead.",
};
export const codeLabel = (code: string) => CODE_LABELS[code] ?? code.replace(/_/g, " ");

/** Error message preferring our friendly copy for known domain codes. */
export function expenseErrorMessage(e: unknown, fallback: (e: unknown) => string): string {
  if (isApiError(e) && CODE_LABELS[e.code]) return CODE_LABELS[e.code];
  return fallback(e);
}

/** Line ids the backend reported as missing a justification (422 `justification_required`). */
export function justificationLineIds(e: unknown): string[] {
  if (!isApiError(e) || e.code !== "justification_required") return [];
  const ids = e.details.line_ids;
  return Array.isArray(ids) ? ids.map(String) : [];
}

/** A flagged line (or preview) needs a non-empty justification before submit. */
export function needsJustification(
  line: Pick<WorkerLine, "flags"> | Pick<LinePreviewOut, "flags" | "justification_required">,
): boolean {
  if ("justification_required" in line && line.justification_required) return true;
  return (line.flags ?? []).length > 0;
}

/** Validation message for the justification field, or null. */
export function justificationError(flagged: boolean, justification: string | null | undefined): string | null {
  if (!flagged) return null;
  return (justification ?? "").trim() ? null : "A justification is required for flagged expenses.";
}

/** Lines of a claim that are flagged but have no justification. */
export function linesMissingJustification(lines: Pick<WorkerLine, "id" | "flags" | "justification">[]): string[] {
  return lines.filter((l) => needsJustification(l) && !(l.justification ?? "").trim()).map((l) => l.id);
}

/**
 * Amount shown for a line in the entry form. Mileage amounts are computed by the server (km x policy rate) and
 * shown read-only from the preview; other categories show the typed amount.
 */
export function displayAmount(
  category: ExpenseCategory,
  typedAmount: string,
  typedCurrency: string,
  preview: Pick<LinePreviewOut, "amount" | "currency" | "amount_claim_ccy" | "claim_currency"> | null | undefined,
): string {
  if (category === "mileage") {
    if (!preview) return "—";
    return formatMoney(preview.amount ?? preview.amount_claim_ccy, preview.currency || preview.claim_currency);
  }
  return typedAmount.trim() ? formatMoney(typedAmount.trim(), typedCurrency) : "—";
}

/** Converted claim-currency amount when the line is in a foreign currency, else null. */
export function convertedAmount(preview: LinePreviewOut | null | undefined): string | null {
  if (!preview || !preview.fx_rate || preview.currency === preview.claim_currency) return null;
  return `${formatMoney(preview.amount_claim_ccy, preview.claim_currency)} at ${preview.fx_rate}${
    preview.fx_rate_date ? ` (${preview.fx_rate_date})` : ""
  }`;
}

/** Build the request body of a line from form state (mileage sends km and no amount). */
export function buildLineIn(f: {
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  amount: string;
  currency: string;
  km: string;
  receipt_file_id: string | null;
  billable: boolean | null;
  reimbursable?: boolean;
  justification: string;
}): LineIn {
  const mileage = f.category === "mileage";
  return {
    expense_date: f.expense_date,
    category: f.category,
    description: f.description.trim() || null,
    amount: mileage ? null : f.amount.trim() || null,
    currency: mileage ? null : f.currency.trim().toUpperCase() || null,
    km: mileage ? f.km.trim() || null : null,
    receipt_file_id: f.receipt_file_id,
    billable: f.billable,
    reimbursable: f.reimbursable ?? true,
    justification: f.justification.trim() || null,
  };
}

// ---------------------------------------------------------------- AI receipt suggestions
export type SuggestedField = "expense_date" | "amount" | "currency" | "category" | "description";
export type AppliedSuggestion = {
  values: Partial<Record<SuggestedField, string>>;
  /** Fields that were filled from the AI read and must show "Suggested — please check". */
  suggested: SuggestedField[];
};

export const SUGGESTED_HINT = "Suggested — please check";

/**
 * Map an AI receipt read onto form fields. Only non-empty, well-formed values are used; every used field is
 * listed in `suggested` so the form labels it. Nothing is ever submitted automatically.
 */
export function applySuggestion(s: ReceiptSuggestion | null | undefined): AppliedSuggestion {
  const values: AppliedSuggestion["values"] = {};
  if (!s) return { values, suggested: [] };
  if (s.expense_date && /^\d{4}-\d{2}-\d{2}$/.test(s.expense_date)) values.expense_date = s.expense_date;
  if (s.amount && /^\d+(\.\d{1,2})?$/.test(s.amount.trim())) values.amount = s.amount.trim();
  if (s.currency && /^[A-Za-z]{3}$/.test(s.currency)) values.currency = s.currency.toUpperCase();
  if (s.category && (EXPENSE_CATEGORIES as readonly string[]).includes(s.category) && s.category !== "mileage") values.category = s.category;
  if (s.merchant && s.merchant.trim()) values.description = s.merchant.trim();
  return { values, suggested: Object.keys(values) as SuggestedField[] };
}

/** Hint text for a field: the suggestion label while the field still holds the suggested value. */
export function suggestionHint(field: SuggestedField, suggested: readonly SuggestedField[]): string | undefined {
  return suggested.includes(field) ? SUGGESTED_HINT : undefined;
}

// ---------------------------------------------------------------- decisions
export type LineDecisionState = Record<string, { decision: Decision; comment: string }>;

/**
 * Validate a decide payload: a whole-claim reject needs a comment; every rejected line needs a comment.
 * Returns `{}` when valid, else messages keyed by `claim` or by line id.
 */
export function decideErrors(body: DecideIn): Record<string, string> {
  const out: Record<string, string> = {};
  if (body.action === "reject" && !(body.comment ?? "").trim()) out.claim = "A comment is required to reject the claim.";
  for (const d of body.line_decisions) {
    if (d.decision === "reject" && !(d.comment ?? "").trim()) out[d.line_id] = "A comment is required to reject this expense.";
  }
  return out;
}

/** Build the decide body from per-line UI state (lines without an explicit choice are approved). */
export function buildDecideBody(action: Decision, comment: string, lineIds: string[], state: LineDecisionState): DecideIn {
  return {
    action,
    comment: comment.trim() || null,
    line_decisions:
      action === "reject"
        ? []
        : lineIds.map((id) => ({
            line_id: id,
            decision: state[id]?.decision ?? "approve",
            comment: (state[id]?.comment ?? "").trim() || null,
          })),
  };
}

// ---------------------------------------------------------------- dates & policies
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Local date as YYYY-MM-DD, `offsetDays` from today. */
export function isoDate(offsetDays = 0, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function defaultPolicyCategory(category: ExpenseCategory): PolicyCategory {
  return {
    category,
    enabled: true,
    daily_limit: null,
    claim_limit: null,
    limit_currency: "INR",
    receipt_required_above: null,
    mileage_rate_per_km: null,
    default_billable: false,
    rebill_method: "at_cost",
    markup_pct: null,
    rebill_tax_mode: "taxable",
  };
}

/** Every category in canonical order, filling missing ones with defaults. */
export function completeCategories(cats: PolicyCategory[]): PolicyCategory[] {
  return EXPENSE_CATEGORIES.map((c) => cats.find((x) => x.category === c) ?? defaultPolicyCategory(c));
}

/** Validation messages for a policy editor, keyed `<category>.<field>`. */
export function policyErrors(cats: PolicyCategory[]): Record<string, string> {
  const out: Record<string, string> = {};
  const dec = /^\d+(\.\d{1,4})?$/;
  for (const c of cats) {
    for (const f of ["daily_limit", "claim_limit", "receipt_required_above", "mileage_rate_per_km", "markup_pct"] as const) {
      const v = c[f];
      if (v !== null && v !== "" && !dec.test(v)) out[`${c.category}.${f}`] = "Enter a non-negative number.";
    }
    if (!/^[A-Z]{3}$/.test(c.limit_currency)) out[`${c.category}.limit_currency`] = "Use a 3-letter currency code.";
    if (c.rebill_method === "markup" && !c.markup_pct) out[`${c.category}.markup_pct`] = "Markup % is required.";
    if (c.category === "mileage" && c.enabled && !c.mileage_rate_per_km) out["mileage.mileage_rate_per_km"] = "Rate per km is required for mileage.";
  }
  return out;
}
