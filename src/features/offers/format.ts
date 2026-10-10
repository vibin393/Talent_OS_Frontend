/** Labels, badge colors and money formatting for offers. */
import type { EmploymentType, Money, OfferStatus, RateUnit, WorkMode } from "./types";

export type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";

export const OFFER_STATUS: Record<OfferStatus, { label: string; color: BadgeColor }> = {
  draft: { label: "Draft", color: "informative" },
  pending_approval: { label: "Pending approval", color: "warning" },
  approved: { label: "Approved", color: "brand" },
  released: { label: "Released", color: "important" },
  viewed: { label: "Viewed", color: "important" },
  accepted: { label: "Accepted", color: "success" },
  declined: { label: "Declined", color: "danger" },
  expired: { label: "Expired", color: "subtle" },
  withdrawn: { label: "Withdrawn", color: "subtle" },
};

export const TERMINAL_STATUSES: readonly OfferStatus[] = ["accepted", "declined", "expired", "withdrawn"];

export const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "permanent", label: "Permanent" },
  { value: "contract", label: "Contract" },
  { value: "contract_to_hire", label: "Contract to hire" },
  { value: "freelance", label: "Freelance" },
];

export const RATE_UNITS: { value: RateUnit; label: string; per: string }[] = [
  { value: "hour", label: "Per hour", per: "/hour" },
  { value: "day", label: "Per day", per: "/day" },
  { value: "month", label: "Per month", per: "/month" },
  { value: "year", label: "Per year", per: "/year" },
];

export const WORK_MODES: { value: WorkMode; label: string }[] = [
  { value: "onsite", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
];

export function employmentLabel(t: string | null | undefined): string {
  return EMPLOYMENT_TYPES.find((x) => x.value === t)?.label ?? (t ? t.replace(/_/g, " ") : "—");
}

export function workModeLabel(m: string | null | undefined): string {
  return WORK_MODES.find((x) => x.value === m)?.label ?? "—";
}

export function unitSuffix(u: string | null | undefined): string {
  return RATE_UNITS.find((x) => x.value === u)?.per ?? "";
}

/** "INR 1,800.00" style (currency code + grouped amount, never floating-point rounding of the string). */
export function formatMoney(m: Money | null | undefined, unit?: string | null): string {
  if (!m) return "—";
  const n = Number(m.amount);
  let text: string;
  try {
    text = Number.isFinite(n)
      ? new Intl.NumberFormat(undefined, { style: "currency", currency: m.currency, currencyDisplay: "code", minimumFractionDigits: 2 }).format(n)
      : `${m.currency} ${m.amount}`;
  } catch {
    text = `${m.currency} ${m.amount}`;
  }
  return `${text}${unit ? unitSuffix(unit) : ""}`;
}

/** "12 Oct 2026" from a `YYYY-MM-DD` calendar date. */
export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) return date;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Human messages for the Epic 8 error codes (falls back to the server message). */
export function offerErrorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "application_not_selected":
      return "Offers can only be made to applications in Selected.";
    case "offer_exists":
      return "This application already has an open offer.";
    case "version_conflict":
      return "Someone else changed this offer. Reload it and try again.";
    case "offer_locked_pending_approval":
      return "The offer is waiting for approval and cannot be edited. Withdraw it, or wait for the approver.";
    case "offer_terminal":
      return "This offer is closed and can no longer be changed.";
    case "expiry_in_past":
      return "The expiry date is in the past. Choose a later date.";
    case "currency_mismatch":
      return "Pay and bill rates must use the same currency.";
    case "demand_not_open":
      return "The demand is not open, so the offer cannot be released.";
    // Epic 16: the offer bill rate is outside the client's rate card.
    case "rate_exception_required":
      return "Outside rate card — needs approval. An approval request was sent to Finance; release again once it is approved.";
    case "rate_exception_pending":
      return "A rate exception for this bill rate is waiting for approval.";
    case "rate_exception_rejected":
      return "The rate exception was rejected. Change the bill rate to release the offer.";
    case "candidate_email_missing":
      return "The candidate has no email address. Add one before releasing.";
    case "letter_not_ready":
      return "The offer letter is still being prepared. Try again in a moment.";
    case "offer_not_open":
      return "This offer is no longer open for a response.";
    case "offer_expired":
      return "This offer has expired.";
    case "offer_version_changed":
      return "This offer was updated — reload to review.";
    case "name_mismatch":
      return "The name you typed does not match the name on the offer.";
    case "unknown_merge_field":
      return "The template uses a merge field that is not allowed.";
    default:
      return fallback;
  }
}
