/** Vendors formatting helpers (Epic 17). Money stays a Decimal string end to end (AD-12, no floats). */
import type { DocStatus, SubmissionStatus, VendorStatus } from "./types";

export const VENDOR_STATUSES: VendorStatus[] = ["prospective", "onboarding", "active", "suspended", "inactive"];
export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  prospective: "Prospective",
  onboarding: "Onboarding",
  active: "Active",
  suspended: "Suspended",
  inactive: "Inactive",
};

/** Allowed manual transitions (mirrors `vendors/records.py` TRANSITIONS for actor `user`). */
export const VENDOR_TRANSITIONS: Record<VendorStatus, VendorStatus[]> = {
  prospective: ["onboarding"],
  onboarding: ["active"],
  active: ["suspended", "inactive"],
  suspended: ["active", "inactive"],
  inactive: [],
};
export const REASON_REQUIRED: VendorStatus[] = ["suspended", "inactive"];

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  accepted: "Accepted",
  rejected: "Rejected",
  duplicate: "Duplicate",
  withdrawn: "Withdrawn",
};

export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  valid: "Valid",
  expiring: "Expiring",
  expired: "Expired",
  no_expiry: "No expiry",
};

export const DUPLICATE_CATEGORY_LABELS: Record<string, string> = {
  owned_by_other_vendor: "Represented by another vendor",
  existing_candidate: "Existing candidate with recent activity",
  submitted_by_other_vendor: "Submitted earlier by another vendor",
  other: "Other duplicate",
};

export const REJECT_REASONS: { code: string; label: string }[] = [
  { code: "skills_mismatch", label: "Not a fit for this role" },
  { code: "rate_too_high", label: "Rate not suitable" },
  { code: "position_filled", label: "Position filled" },
  { code: "other", label: "Other" },
];

export function blockerLabel(code: string): string {
  if (code === "agreement") return "No active vendor agreement";
  if (code.startsWith("document:")) return `Missing or expired ${code.slice(9)} document`;
  return code;
}

const SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

/** Group the integer digits: Indian lakh/crore grouping for INR, thousands otherwise. */
function groupDigits(int: string, indian: boolean): string {
  if (int.length <= 3) return int;
  if (!indian) return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

/**
 * Format a Decimal string as money without converting to a JS number (no float rounding):
 * `"20150.5"` + `INR` -> `"₹20,150.50"`; `"-1234567.891"` -> `"-₹12,34,567.89"` (half-up on the 3rd decimal).
 */
export function formatDecimalMoney(value: string | null | undefined, currency = "INR", places = 2): string {
  if (value === null || value === undefined || value === "") return "—";
  const m = /^(-)?(\d*)(?:\.(\d*))?$/.exec(value.trim());
  if (!m) return value;
  const neg = !!m[1];
  let int = (m[2] || "0").replace(/^0+(?=\d)/, "");
  let frac = m[3] ?? "";
  if (frac.length > places) {
    const roundUp = Number(frac[places]) >= 5;
    frac = frac.slice(0, places);
    if (roundUp) {
      const digits = (int + frac).split("").map(Number);
      let i = digits.length - 1;
      while (i >= 0) {
        if (digits[i] === 9) {
          digits[i] = 0;
          i -= 1;
        } else {
          digits[i] += 1;
          break;
        }
      }
      let joined = digits.join("");
      if (i < 0) joined = `1${joined}`;
      int = joined.slice(0, joined.length - places) || "0";
      frac = joined.slice(joined.length - places);
    }
  }
  frac = frac.padEnd(places, "0");
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  const body = `${groupDigits(int, currency === "INR")}${places ? `.${frac}` : ""}`;
  const isZero = /^[0.,]*$/.test(body);
  return `${neg && !isZero ? "-" : ""}${symbol}${body}`;
}

/** Sum Decimal strings exactly (scaled BigInt arithmetic). */
export function sumDecimals(values: string[], places = 2): string {
  const scale = BigInt(10) ** BigInt(places);
  let total = BigInt(0);
  for (const v of values) {
    const m = /^(-)?(\d*)(?:\.(\d*))?$/.exec(v.trim());
    if (!m) continue;
    const frac = (m[3] ?? "").padEnd(places, "0").slice(0, places);
    const n = BigInt(m[2] || "0") * scale + BigInt(frac || "0");
    total += m[1] ? -n : n;
  }
  const neg = total < BigInt(0);
  const abs = neg ? -total : total;
  const int = (abs / scale).toString();
  const frac = (abs % scale).toString().padStart(places, "0");
  return `${neg ? "-" : ""}${int}${places ? `.${frac}` : ""}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function pct(value: string | null | undefined): string {
  return value === null || value === undefined ? "—" : `${value}%`;
}
