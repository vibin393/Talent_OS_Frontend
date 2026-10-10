/** Pure BGV UI rules (Vitest): labels / colours, the adjudicate guard, the consent gate and Aadhaar input. */
import type { CaseOut, CaseStatus, CheckStatus, CheckType, Severity } from "./types";

type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  initiated: "Initiated",
  documents_pending: "Documents pending",
  in_verification: "In verification",
  discrepancy: "Discrepancy",
  under_review: "Under review",
  clear: "Clear",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const CASE_STATUS_COLORS: Record<CaseStatus, BadgeColor> = {
  initiated: "subtle",
  documents_pending: "informative",
  in_verification: "brand",
  discrepancy: "warning",
  under_review: "important",
  clear: "success",
  failed: "danger",
  cancelled: "subtle",
};

export const CHECK_STATUS_LABELS: Record<CheckStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  verified: "Verified",
  discrepancy: "Discrepancy",
  unable_to_verify: "Unable to verify",
  waived: "Waived",
};

export const CHECK_STATUS_COLORS: Record<CheckStatus, BadgeColor> = {
  pending: "subtle",
  in_progress: "brand",
  verified: "success",
  discrepancy: "warning",
  unable_to_verify: "danger",
  waived: "informative",
};

export const CHECK_TYPE_LABELS: Record<CheckType, string> = {
  identity: "Identity",
  employment: "Employment",
  education: "Education",
  address: "Address",
  reference: "Reference",
  professional_licence: "Professional licence",
  criminal_record: "Criminal record",
  drug_test: "Drug test",
};

export const SEVERITY_COLORS: Record<Severity, BadgeColor> = { minor: "informative", major: "warning", critical: "danger" };

export const LAWFUL_TYPES: readonly CheckType[] = ["criminal_record", "drug_test"];

export function needsLawfulAttestation(types: readonly CheckType[]): boolean {
  return types.some((t) => LAWFUL_TYPES.includes(t));
}

export const MIN_REASONS = 20;

export type AdjudicateGuard = { canClear: boolean; canFail: boolean; blocker: string | null };

/** Mirrors the server rules: Clear only from Under review; Failed from Under review / Discrepancy and never while a
 * discrepancy awaits the candidate. */
export function adjudicateGuard(c: Pick<CaseOut, "status" | "discrepancy_awaiting_response">): AdjudicateGuard {
  const blocker = c.discrepancy_awaiting_response ? "A discrepancy is still awaiting the candidate's response." : null;
  return {
    canClear: c.status === "under_review",
    canFail: (c.status === "under_review" || c.status === "discrepancy") && !c.discrepancy_awaiting_response,
    blocker,
  };
}

export function reasonsError(reasons: string): string | null {
  return reasons.trim().length < MIN_REASONS ? `Give at least ${MIN_REASONS} characters of reasons.` : null;
}

/** Worker portal gate: documents can be uploaded only after consent, while the case collects documents. */
export function consentGate(c: { consent_given: boolean; stage: string; status: string }): "consent" | "documents" | "waiting" | "done" {
  if (c.status !== "in_progress") return "done";
  if (c.stage === "not_started") return "waiting";
  if (!c.consent_given) return "consent";
  return c.stage === "documents" ? "documents" : "waiting";
}

/** Aadhaar input: exactly the last 4 digits; a full 12-digit number is refused before it leaves the browser. */
export function aadhaarLast4Error(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 12) return "Never enter your full Aadhaar number — only the last 4 digits.";
  if (!/^\d{4}$/.test(value.trim())) return "Enter exactly the last 4 digits.";
  return null;
}

export function isActiveCase(status: CaseStatus): boolean {
  return status === "documents_pending" || status === "in_verification" || status === "discrepancy" || status === "under_review";
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function summariseDeclaration(declared: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof declared.aadhaar_last4 === "string") parts.push(`Aadhaar ending ${declared.aadhaar_last4}`);
  const entries = Array.isArray(declared.entries) ? (declared.entries as Record<string, unknown>[]) : [];
  for (const e of entries.slice(0, 3)) parts.push(String(e.employer ?? e.institution ?? e.city ?? e.line ?? ""));
  return parts.filter(Boolean).join(" · ") || "Submitted";
}
