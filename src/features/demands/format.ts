/** Display formatting for demand values. */
import type { DemandOut } from "@/lib/api/types";
import { RATE_UNIT_LABELS } from "./form";

/** A `YYYY-MM-DD` date (or ISO timestamp) as a medium local date. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

/** "INR 1,500.00 per hour", or an em dash. */
export function formatRate(
  amount: string | null | undefined,
  d: Pick<DemandOut, "currency" | "rate_unit">,
): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = Number(amount);
  const text = Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : amount;
  const unit = d.rate_unit ? ` ${RATE_UNIT_LABELS[d.rate_unit].toLowerCase()}` : "";
  return `${d.currency ? `${d.currency} ` : ""}${text}${unit}`;
}

/** "5–8 years", "5+ years" or an em dash. */
export function formatExperience(min: string | null | undefined, max: string | null | undefined): string {
  const f = (v: string) => String(Number(v));
  if (min && max) return `${f(min)}–${f(max)} years`;
  if (min) return `${f(min)}+ years`;
  if (max) return `Up to ${f(max)} years`;
  return "—";
}
