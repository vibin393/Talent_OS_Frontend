/**
 * Pure logic of the Submit-to-client wizard: margin display, per-candidate blockers and the mapping of
 * submission results / API errors back onto the wizard. The server is authoritative; these only stop
 * obviously incomplete requests and explain the server's answers.
 */
import type { MarginOut, ResumeKind, SubmissionRateUnit } from "@/lib/api/types";

// ---------------------------------------------------------------- margin
export type MarginTone = "success" | "warning" | "danger";

/** Format a decimal string amount with its ISO currency (falls back to "1,234.50 XYZ"). */
export function formatMoney(amount: string | number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
    } catch {
      // Unknown currency code: plain number below.
    }
  }
  return `${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ""}`;
}

/** "12.5%" from a decimal string ("12.50"). */
export function formatPct(pct: string | number | null | undefined): string {
  if (pct === null || pct === undefined || pct === "") return "—";
  const n = Number(pct);
  if (!Number.isFinite(n)) return "—";
  return `${Number(n.toFixed(2)).toString()}%`;
}

/** Colour of the margin badge: below the minimum is danger, within 5 points above it a warning. */
export function marginTone(m: Pick<MarginOut, "margin_pct" | "min_margin_pct" | "below_min_margin">): MarginTone {
  if (m.below_min_margin) return "danger";
  const pct = Number(m.margin_pct);
  const min = Number(m.min_margin_pct);
  if (Number.isFinite(pct) && Number.isFinite(min) && pct < min + 5) return "warning";
  return "success";
}

export function marginSummary(m: MarginOut): string {
  return `${formatMoney(m.margin_amount.amount, m.margin_amount.currency)} (${formatPct(m.margin_pct)}) per ${m.rate_unit}`;
}

// ---------------------------------------------------------------- wizard items
export type ConsentState = "granted" | "missing" | "unknown";

export type WizardItem = {
  applicationId: string;
  candidateId: string;
  candidateName: string;
  resumeKind: ResumeKind;
  payAmount: string;
  billAmount: string;
  currency: string;
  payUnit: SubmissionRateUnit;
  billUnit: SubmissionRateUnit;
  /** From `GET /candidates/{id}/consents` (client_submission for this client); unknown without access. */
  consent: ConsentState;
  attest: boolean;
  attestText: string;
  consentRequested: boolean;
  /** Set when the server answered 409 `prior_submission_warning`. */
  priorWarning: { lastSubmittedAt: string | null } | null;
  priorReason: string;
  /** Set when the server answered 409 `submission_consent_required`. */
  consentRequiredByServer: boolean;
};

export const ATTESTATION_MIN = 10;
export const PRIOR_REASON_MIN = 10;

function isAmount(v: string): boolean {
  if (!v.trim()) return false;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && /^\d+(\.\d{1,2})?$/.test(v.trim());
}

export function rateErrors(item: Pick<WizardItem, "payAmount" | "billAmount" | "currency">): { pay?: string; bill?: string; currency?: string } {
  const out: { pay?: string; bill?: string; currency?: string } = {};
  if (!isAmount(item.payAmount)) out.pay = "Enter the pay rate (up to 2 decimals).";
  if (!isAmount(item.billAmount)) out.bill = "Enter the bill rate (up to 2 decimals).";
  if (!/^[A-Z]{3}$/.test(item.currency)) out.currency = "Choose a currency.";
  return out;
}

/** Whether the consent check passes (granted, or a confirmed attestation when the tenant allows it). */
export function consentSatisfied(item: WizardItem, attestationAllowed: boolean): boolean {
  const needsConsent = item.consent === "missing" || item.consentRequiredByServer;
  if (!needsConsent) return true;
  return attestationAllowed && item.attest && item.attestText.trim().length >= ATTESTATION_MIN;
}

/** Reasons this candidate cannot be submitted yet (empty = ready). */
export function itemBlockers(item: WizardItem, attestationAllowed: boolean): string[] {
  const out: string[] = [];
  const rates = rateErrors(item);
  if (rates.pay || rates.bill || rates.currency) out.push("Enter valid pay and bill rates.");
  if (!consentSatisfied(item, attestationAllowed)) {
    out.push(
      item.consentRequested
        ? "Waiting for the candidate's consent (request sent)."
        : attestationAllowed
          ? "Consent needed: send a consent request or attest that the candidate agreed."
          : "Consent needed: send the candidate a consent request.",
    );
  }
  if (item.priorWarning && item.priorReason.trim().length < PRIOR_REASON_MIN) {
    out.push(`Submitted to this client recently: give a reason (at least ${PRIOR_REASON_MIN} characters).`);
  }
  return out;
}

/** Remaining submissions before the demand's limit (null = no limit). */
export function remainingSubmissions(limit: number | null | undefined, used: number): number | null {
  if (limit === null || limit === undefined) return null;
  return Math.max(0, limit - used);
}

/** Every blocker of the whole wizard (per candidate, recipients, limit). */
export function wizardBlockers(
  items: readonly WizardItem[],
  opts: { attestationAllowed: boolean; recipientCount: number; remaining: number | null },
): string[] {
  const out: string[] = [];
  for (const item of items) {
    for (const b of itemBlockers(item, opts.attestationAllowed)) out.push(`${item.candidateName}: ${b}`);
  }
  if (opts.recipientCount === 0) out.push("Choose at least one client contact.");
  if (opts.remaining !== null && items.length > opts.remaining) {
    out.push(
      opts.remaining === 0
        ? "The demand's submission limit has been reached."
        : `Only ${opts.remaining} more submission${opts.remaining === 1 ? "" : "s"} allowed on this demand.`,
    );
  }
  return out;
}

// ---------------------------------------------------------------- results
export type ResultError = { code?: string; message?: string; details?: Record<string, unknown> } | null | undefined;

/** Fold a blocked result back into the wizard item (prior-submission / consent answers). */
export function applyBlockedResult(item: WizardItem, error: ResultError): WizardItem {
  if (!error) return item;
  if (error.code === "prior_submission_warning") {
    const last = error.details?.last_submitted_at;
    return { ...item, priorWarning: { lastSubmittedAt: typeof last === "string" ? last : null } };
  }
  if (error.code === "submission_consent_required") return { ...item, consentRequiredByServer: true };
  return item;
}

export const RESULT_LABELS: Record<string, string> = {
  sent: "Sent",
  pending_approval: "Pending margin approval",
  blocked: "Blocked",
};
