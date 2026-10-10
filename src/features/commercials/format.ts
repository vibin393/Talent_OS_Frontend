/**
 * Pure helpers of the commercials UI (Epic 16). Money arrives as decimal strings and is only formatted for
 * display (`Intl.NumberFormat`); no arithmetic is done on parsed floats except for the progress bar ratio.
 */
import { isApiError } from "@/lib/api/errors";
import type {
  ContractOut,
  ContractStatus,
  ContractType,
  PoValidityState,
  RateCheckPreviewOut,
  RateCheckResultCode,
  TaxTreatment,
} from "./types";

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  msa: "MSA",
  sow: "SOW",
  amendment: "Amendment",
  vendor_agreement: "Vendor agreement",
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  active: "Active",
  expired: "Expired",
  terminated: "Terminated",
};

export type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";

export const CONTRACT_STATUS_COLORS: Record<ContractStatus, BadgeColor> = {
  draft: "informative",
  pending_approval: "warning",
  active: "success",
  expired: "subtle",
  terminated: "danger",
};

export const TAX_TREATMENT_LABELS: Record<TaxTreatment, string> = {
  registered: "GST registered",
  unregistered: "Unregistered",
  sez: "SEZ",
  export: "Export (outside India)",
};

/** A decimal string for display in `currency` (e.g. `₹1,800.00`); "—" when empty. */
export function formatMoney(amount: string | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  const cur = (currency || "").toUpperCase();
  const locale = cur === "INR" ? "en-IN" : undefined;
  try {
    if (cur) return new Intl.NumberFormat(locale, { style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  } catch {
    // Unknown currency code: fall through to a plain number.
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(n)}${cur ? ` ${cur}` : ""}`;
}

export function formatHours(hours: string | null | undefined): string {
  if (hours === null || hours === undefined || hours === "") return "—";
  const n = Number(hours);
  return Number.isFinite(n) ? `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n)} h` : hours;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });
}

/** `YYYY-MM-DD` of the day before `iso` (the end of the version a new rate card supersedes). */
export function dayBefore(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) - 86_400_000);
  return t.toISOString().slice(0, 10);
}

/** The computed end date of the current published version when a draft starting `effectiveFrom` is published;
 * `null` when there is no current version or the new start would overlap it. */
export function supersededEndDate(currentEffectiveFrom: string | null | undefined, effectiveFrom: string | null | undefined): string | null {
  if (!currentEffectiveFrom || !effectiveFrom) return null;
  if (effectiveFrom <= currentEffectiveFrom) return null;
  return dayBefore(effectiveFrom);
}

// ---------------------------------------------------------------- rate checks
export type RateCheckView = { label: string; color: BadgeColor; needsApproval: boolean };

export function rateCheckView(result: RateCheckResultCode | null | undefined, preview?: Pick<RateCheckPreviewOut, "min_bill_rate" | "max_bill_rate">, currency?: string): RateCheckView {
  switch (result) {
    case "ok": {
      const range =
        preview?.min_bill_rate && preview?.max_bill_rate
          ? ` (${formatMoney(preview.min_bill_rate, currency)}–${formatMoney(preview.max_bill_rate, currency)})`
          : "";
      return { label: `Within rate card${range}`, color: "success", needsApproval: false };
    }
    case "out_of_range":
    case "vendor_rate_exceeded":
      return { label: "Outside rate card — needs approval", color: "warning", needsApproval: true };
    case "no_matching_line":
      return { label: "No matching rate card line", color: "warning", needsApproval: true };
    case "not_validated":
      return { label: "Not validated", color: "subtle", needsApproval: false };
    default:
      return { label: "Not checked", color: "subtle", needsApproval: false };
  }
}

export const RATE_EXCEPTION_CODES = ["rate_exception_required", "rate_exception_pending", "rate_exception_rejected"] as const;
export type RateExceptionCode = (typeof RATE_EXCEPTION_CODES)[number];

export type RateExceptionInfo = { code: RateExceptionCode; approvalRequestId: string | null; min: string | null; max: string | null };

/** The rate-exception details of a 409 from a gated action, or null for any other error. */
export function rateExceptionInfo(e: unknown): RateExceptionInfo | null {
  if (!isApiError(e) || e.status !== 409) return null;
  if (!(RATE_EXCEPTION_CODES as readonly string[]).includes(e.code)) return null;
  const d = e.details;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return { code: e.code as RateExceptionCode, approvalRequestId: str(d.approval_request_id), min: str(d.min), max: str(d.max) };
}

export function rateExceptionMessage(info: RateExceptionInfo): string {
  if (info.code === "rate_exception_pending") return "A rate exception for this rate is waiting for approval.";
  if (info.code === "rate_exception_rejected") return "The rate exception was rejected. Change the rate to continue.";
  const range = info.min && info.max ? ` The rate card allows ${info.min}–${info.max}.` : "";
  return `Outside rate card — needs approval.${range} An approval request was sent to Finance; retry once it is approved.`;
}

// ---------------------------------------------------------------- purchase orders
export type ProgressColor = "brand" | "warning" | "error";

/** Consumption bar colour: brand below 80 %, warning from 80 %, error at 100 % or more. */
export function poProgressColor(pctUsed: string | null | undefined): ProgressColor {
  const pct = Number(pctUsed ?? 0);
  if (pct >= 100) return "error";
  if (pct >= 80) return "warning";
  return "brand";
}

/** Bar value in [0, 1]. */
export function poProgressValue(pctUsed: string | null | undefined): number {
  const pct = Number(pctUsed ?? 0);
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return Math.min(pct / 100, 1);
}

/** Validity derived from the dates (never stored): `today` is a `YYYY-MM-DD` string. */
export function poValidity(validFrom: string, validTo: string, today: string): PoValidityState {
  if (today < validFrom) return "upcoming";
  if (today > validTo) return "expired";
  return "valid";
}

export const PO_VALIDITY: Record<PoValidityState, { label: string; color: BadgeColor }> = {
  upcoming: { label: "Upcoming", color: "informative" },
  valid: { label: "Valid", color: "success" },
  expired: { label: "Expired", color: "subtle" },
};

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------- billing addresses
/** Whether a billing address needs a GSTIN: registered / SEZ clients billed at an Indian address. */
export function gstinRequired(taxTreatment: TaxTreatment, country: string): boolean {
  return (taxTreatment === "registered" || taxTreatment === "sez") && country.toUpperCase() === "IN";
}

// ---------------------------------------------------------------- contract actions
export type ContractAction = "submit" | "activate" | "terminate" | "signature" | "edit";

/** Actions offered on a contract in its current status (the server enforces the same table). */
export function contractActions(c: Pick<ContractOut, "status" | "approval_chain_configured" | "approved_at" | "signed_file_id">): ContractAction[] {
  const out: ContractAction[] = [];
  if (c.status === "draft") {
    out.push("edit");
    if (c.approval_chain_configured && !c.approved_at) out.push("submit");
    if (!c.approval_chain_configured || c.approved_at) out.push("activate");
    out.push("signature");
  } else if (c.status === "pending_approval") {
    out.push("signature");
    if (c.approved_at) out.push("activate");
  } else if (c.status === "active") {
    out.push("terminate");
  }
  return out;
}
