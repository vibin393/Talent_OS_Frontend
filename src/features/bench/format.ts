/**
 * Pure helpers of the bench UI (Epic 24). Money arrives as decimal strings and is formatted as strings --
 * never through `Number()` -- so `"4545.45"` stays exact.
 */
import type { BenchStatus, OptInIn, ReleaseReason } from "./types";

export type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";

export const BENCH_STATUS_LABELS: Record<BenchStatus, string> = {
  on_bench: "On bench",
  proposed: "Proposed",
  redeployed: "Redeployed",
  released: "Released",
};

export const BENCH_STATUS_COLORS: Record<BenchStatus, BadgeColor> = {
  on_bench: "warning",
  proposed: "brand",
  redeployed: "success",
  released: "subtle",
};

export const RELEASE_REASONS: { value: ReleaseReason; label: string }[] = [
  { value: "resigned", label: "Resigned" },
  { value: "terminated", label: "Terminated" },
  { value: "contractor_unavailable", label: "Contractor unavailable" },
  { value: "other", label: "Other" },
];

const SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "AED ", SGD: "S$" };

/** Group the integer part of a decimal string: Indian grouping for INR (12,34,567), thousands otherwise. */
function group(intPart: string, indian: boolean): string {
  if (intPart.length <= 3) return intPart;
  const last3 = intPart.slice(-3);
  let rest = intPart.slice(0, -3);
  const size = indian ? 2 : 3;
  const parts: string[] = [];
  while (rest.length > size) {
    parts.unshift(rest.slice(-size));
    rest = rest.slice(0, -size);
  }
  if (rest) parts.unshift(rest);
  return `${parts.join(",")},${last3}`;
}

/** Format a decimal string for display, e.g. `formatDecimal("4545.45", "INR") === "₹4,545.45"`. */
export function formatDecimal(amount: string | null | undefined, currency?: string | null): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!m) return amount;
  const [, sign, intPart, frac] = m;
  const cur = (currency || "").toUpperCase();
  const grouped = group(intPart.replace(/^0+(?=\d)/, ""), cur === "INR");
  const body = frac !== undefined ? `${grouped}.${frac}` : grouped;
  const symbol = cur ? (SYMBOLS[cur] ?? `${cur} `) : "";
  return `${sign}${symbol}${body}`;
}

/** Cost cell text: masked (no `compensation:view`), unknown (unsupported rate unit) or the formatted amount. */
export function costText(value: string | null, currency: string | null, masked: boolean): string {
  if (masked) return "••••";
  if (value === null) return "—";
  return formatDecimal(value, currency);
}

/** A money input: digits with up to 2 decimals (validated as a string). */
export function isMoney(value: string): boolean {
  return /^\d{1,14}(\.\d{1,2})?$/.test(value.trim());
}

export function releaseValid(reason: ReleaseReason | "", note: string): boolean {
  if (!reason) return false;
  return reason !== "other" || note.trim().length > 0;
}

export type OptInErrors = Partial<Record<keyof OptInIn, string>>;

export function optInErrors(form: OptInIn, today: string): OptInErrors {
  const errors: OptInErrors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.available_from)) errors.available_from = "Choose the date you are available from";
  else if (form.available_from < today) errors.available_from = "The date cannot be in the past";
  if ((form.work_authorization ?? "").length > 500) errors.work_authorization = "Keep it under 500 characters";
  if (form.preferred_locations.length > 20) errors.preferred_locations = "List at most 20 locations";
  return errors;
}

export function parseLocations(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function benchDaysLabel(days: number | null): string {
  if (days === null) return "";
  return `On bench ${days} day${days === 1 ? "" : "s"}`;
}

export function pctText(rate: string | null): string {
  if (rate === null) return "—";
  const m = /^(\d+)(?:\.(\d+))?$/.exec(rate);
  if (!m) return rate;
  // 4 dp fraction -> percent with 1 dp, by string shifting (no float maths)
  const digits = `${m[1]}${(m[2] ?? "").padEnd(4, "0").slice(0, 4)}`.replace(/^0+(?=\d)/, "");
  const padded = digits.padStart(3, "0");
  const whole = padded.slice(0, -2).replace(/^0+(?=\d)/, "") || "0";
  return `${whole}.${padded.slice(-2, -1)} %`;
}

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });
}

/** Bench list columns; Cost/day only for `compensation:view`. */
export function benchColumnIds(canViewCompensation: boolean): string[] {
  const ids = ["worker", "skills", "location", "from", "days", "cost", "status", "proposed"];
  return canViewCompensation ? ids : ids.filter((id) => id !== "cost");
}

/** Bench section rows: exactly the API order (deterministic ranking, AD-8) -- the UI never re-sorts. */
export function sectionItems<T>(items: readonly T[]): T[] {
  return [...items];
}
