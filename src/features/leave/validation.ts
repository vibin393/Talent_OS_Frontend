/**
 * Pure leave helpers (Epic 26): half-day form rules, signed-decimal validation for balance adjustments, day
 * labels and calendar view models. No float arithmetic on day values.
 */
import type { ClientLeaveCalendarOut, LeaveStatus } from "./types";

/** Signed decimal days for an adjustment: up to 3 integer digits, at most 2 decimals, non-zero. */
export const SIGNED_DAYS_RE = /^-?\d{1,3}(\.\d{1,2})?$/;
export const DAYS_RE = /^\d{1,3}(\.\d{1,2})?$/;

export function adjustmentErrors(days: string, reason: string): { days?: string; reason?: string } {
  const out: { days?: string; reason?: string } = {};
  const v = days.trim();
  if (!SIGNED_DAYS_RE.test(v)) out.days = "Enter days like 1.5 or -0.25 (at most 2 decimals).";
  else if (/^-?0+(\.0+)?$/.test(v)) out.days = "Days cannot be zero.";
  if (!reason.trim()) out.reason = "A reason is required.";
  return out;
}

export interface HalfDayForm {
  start_date: string;
  end_date: string;
  start_half: boolean;
  end_half: boolean;
  allow_half_day: boolean;
}

/** Form-level rules mirrored from the backend (FR-136). Returns an error message or null. */
export function halfDayError(f: HalfDayForm): string | null {
  if (!f.start_date || !f.end_date) return "Choose the start and end dates.";
  if (f.end_date < f.start_date) return "The end date is before the start date.";
  if ((f.start_half || f.end_half) && !f.allow_half_day) return "Half days are not allowed for this leave type.";
  if (f.start_date === f.end_date && f.start_half && f.end_half)
    return "A single day cannot take both halves; request a full day instead.";
  return null;
}

/** "1.00" -> "1 day", "1.50" -> "1.5 days" (string-only formatting). */
export function formatDays(days: string): string {
  const m = /^(-?\d+)(?:\.(\d+))?$/.exec(days.trim());
  if (!m) return `${days} days`;
  const frac = (m[2] ?? "").replace(/0+$/, "");
  const text = frac ? `${m[1]}.${frac}` : m[1];
  return text === "1" || text === "-1" ? `${text} day` : `${text} days`;
}

export function previewText(days: string | undefined, errorCode: string | null | undefined): string {
  if (errorCode === "no_working_days") return "These dates have no working days.";
  if (errorCode === "balance_insufficient") return `${formatDays(days ?? "0")} — not enough balance.`;
  if (errorCode === "half_day_invalid") return "A single day cannot take both halves.";
  if (errorCode) return "These dates cannot be requested.";
  return days ? formatDays(days) : "";
}

export const STATUS_LABEL: Record<LeaveStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  cancellation_requested: "Cancellation requested",
  cancelled: "Cancelled",
};

export const STATUS_COLOR: Record<LeaveStatus, "informative" | "success" | "danger" | "subtle" | "warning"> = {
  requested: "informative",
  approved: "success",
  rejected: "danger",
  withdrawn: "subtle",
  cancellation_requested: "warning",
  cancelled: "subtle",
};

export function halfLabel(half: string | null | undefined): string {
  return half === "am" ? " (morning)" : half === "pm" ? " (afternoon)" : "";
}

/** Client calendar cells: one label per worker/day, never a leave type (the API doesn't send one). */
export function clientCalendarCells(data: ClientLeaveCalendarOut): { worker: string; date: string; text: string }[] {
  return data.rows.flatMap((r) =>
    r.days.map((d) => ({ worker: r.worker_name ?? "Worker", date: d.date, text: `${d.label}${halfLabel(d.half)}` })),
  );
}

/** Dates of the month containing `iso` ("YYYY-MM-DD"), as ISO strings. */
export function monthDates(iso: string): string[] {
  const [y, m] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: last }, (_, i) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`);
}

export function toPickerDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function fromPickerDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
