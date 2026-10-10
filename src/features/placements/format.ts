/**
 * Pure helpers of the placements UI (Epic 19). Money arrives as decimal strings and is only formatted for display.
 */
import { isApiError } from "@/lib/api/errors";
import type { GateStatus, PlacementListItem, PlacementStatus, RateSegmentOut, UnmetGate } from "./types";

export type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";

export const STATUS_LABELS: Record<PlacementStatus, string> = {
  pre_joining: "Pre-joining",
  joining_confirmed: "Joining confirmed",
  active: "Active",
  offboarding: "Offboarding",
  ended: "Ended",
  dropped: "Dropped",
};

export const STATUS_COLORS: Record<PlacementStatus, BadgeColor> = {
  pre_joining: "informative",
  joining_confirmed: "brand",
  active: "success",
  offboarding: "warning",
  ended: "subtle",
  dropped: "danger",
};

export const GATE_LABELS: Record<GateStatus, string> = {
  pending: "Pending",
  met: "Met",
  failed: "Failed",
  waived: "Waived",
  not_required: "Not required",
};

export const GATE_COLORS: Record<GateStatus, BadgeColor> = {
  pending: "warning",
  met: "success",
  failed: "danger",
  waived: "informative",
  not_required: "subtle",
};

export const SETUP_ITEM_LABELS: Record<string, { label: string; href?: string }> = {
  contract_missing: { label: "No active client contract", href: "/contracts" },
  po_missing: { label: "No purchase order", href: "/purchase-orders" },
  billing_rule_missing: { label: "No billing rule" },
  rate_card_unchecked: { label: "Rates not checked against a rate card" },
  vendor_unchecked: { label: "Vendor sourcing not checked" },
};

export const DROPOUT_RULE_LABELS: Record<string, string> = {
  no_response: "No response to joining reminders",
  low_onboarding: "Onboarding behind within 7 days of start",
  counter_offer: "Counter-offer recorded",
};

export const DROP_REASON_LABELS = {
  declined: "Declined",
  no_show: "No show",
  bgv_failed: "BGV failed",
  client_cancelled: "Client cancelled",
} as const;

export const SAVED_VIEWS = [
  { value: "all", label: "All" },
  { value: "ending_30", label: "Ending in 30 days" },
  { value: "ending_60", label: "Ending in 60 days" },
  { value: "non_compliant", label: "Non-compliant" },
] as const;

export function formatMoney(amount: string | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  const cur = (currency || "").toUpperCase();
  try {
    if (cur) {
      return new Intl.NumberFormat(cur === "INR" ? "en-IN" : undefined, {
        style: "currency",
        currency: cur,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n);
    }
  } catch {
    // unknown currency code: plain number below
  }
  return n.toFixed(2);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });
}

export function formatPct(pct: string | null | undefined): string {
  if (pct === null || pct === undefined || pct === "") return "—";
  const n = Number(pct);
  return Number.isFinite(n) ? `${n.toFixed(2)} %` : pct;
}

/** Rates and margin come back `null` without `compensation:view`: show a masked placeholder, never `0`. */
export function maskedRate(value: string | null | undefined, currency: string, canView: boolean): string {
  if (!canView) return "••••";
  return formatMoney(value, currency);
}

export function segmentLabel(s: Pick<RateSegmentOut, "effective_from" | "effective_to">): string {
  return s.effective_to ? `${formatDate(s.effective_from)} – ${formatDate(s.effective_to)}` : `From ${formatDate(s.effective_from)}`;
}

/** Flag icons of a list row. */
export function placementFlags(p: Pick<PlacementListItem, "ending_soon" | "non_compliant" | "compliance_blocked" | "dropout_risk" | "setup_items">): string[] {
  const out: string[] = [];
  if (p.ending_soon) out.push("Ending soon");
  if (p.non_compliant || p.compliance_blocked) out.push("Non-compliant");
  if (p.dropout_risk) out.push("Dropout risk");
  if (p.setup_items.length > 0) out.push("Setup incomplete");
  return out;
}

/** The unmet gates of a 409 `start_gates_unmet` (Mark Joined), or `null` for any other error. */
export function unmetGatesFrom(error: unknown): UnmetGate[] | null {
  if (!isApiError(error) || error.status !== 409 || error.code !== "start_gates_unmet") return null;
  const gates = (error.details as { gates?: UnmetGate[] } | undefined)?.gates;
  return Array.isArray(gates) ? gates : [];
}

export function daysToStartLabel(days: number): string {
  if (days === 0) return "Today";
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} ago`;
  return `In ${days} day${days === 1 ? "" : "s"}`;
}

/** Debounce-friendly check that a decimal-string input is a usable rate. */
export function isRate(value: string): boolean {
  return /^\d{1,10}(\.\d{1,4})?$/.test(value.trim());
}

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
