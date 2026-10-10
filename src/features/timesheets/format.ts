/** Pure helpers of the Timesheets UI (Epic 25): labels, colors, date grid, OT split display, decision rules. */
import { formatHundredths, toHundredths } from "./decimal";
import type { ClientBulkPreviewOut, ClientDecision, TimesheetStatus, WorkerDaySplit, WorkerSplitPreview } from "./types";

export type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";

export const STATUS_LABELS: Record<TimesheetStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  in_approval: "In approval",
  approved: "Approved",
  rejected: "Rejected",
};

export const STATUS_COLORS: Record<TimesheetStatus, BadgeColor> = {
  draft: "subtle",
  submitted: "informative",
  in_approval: "brand",
  approved: "success",
  rejected: "danger",
};

export function statusLabel(s: string): string {
  return STATUS_LABELS[s as TimesheetStatus] ?? s;
}
export function statusColor(s: string): BadgeColor {
  return STATUS_COLORS[s as TimesheetStatus] ?? "subtle";
}

export const CATEGORY_LABELS: Record<string, string> = {
  regular: "Regular",
  ot: "Overtime",
  double_time: "Double time",
  holiday: "Holiday",
  leave_paid: "Paid leave",
  leave_unpaid: "Unpaid leave",
};
export const categoryLabel = (c: string) => CATEGORY_LABELS[c] ?? c;

export const ROUTE_KIND_LABELS: Record<string, string> = {
  placement_account_manager: "Placement account manager",
  user: "Specific user",
  client_user: "Specific client user",
  client_any: "Any client approver",
  finance_role: "Finance role",
};

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Parse "YYYY-MM-DD" as a UTC date (no timezone drift). */
function parseIso(d: string): Date {
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}
function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** All ISO dates from `start` to `end` inclusive. */
export function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const last = parseIso(end).getTime();
  for (let d = parseIso(start); d.getTime() <= last && out.length < 62; d = new Date(d.getTime() + 86_400_000)) out.push(toIso(d));
  return out;
}

/** Group dates into weeks of 7 (for week-grid paging of longer periods). */
export function chunkWeeks(dates: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < dates.length; i += 7) out.push(dates.slice(i, i + 7));
  return out;
}

export function dayLabel(iso: string): string {
  const d = parseIso(iso);
  return `${WEEKDAY_LABELS[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()}`;
}

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  return parseIso(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatPeriod(start: string, end: string): string {
  return `${formatDay(start)} – ${formatDay(end)}`;
}

/** Cell key of the entry grid. */
export const cellKey = (date: string, category: string) => `${date}|${category}`;

// ---------------------------------------------------------------- OT split display
export type SplitRow = { label: string; hours: string };

/**
 * Read-only OT split shown in the Worker's Submit dialog: one row per category with a non-zero total, in a fixed
 * order (Regular, Overtime, Double time, other), plus the grand total computed via hundredths.
 */
export function splitDisplay(preview: WorkerSplitPreview): { rows: SplitRow[]; total: string } {
  const order = ["regular", "ot", "double_time", "holiday", "leave_paid", "leave_unpaid"];
  const rank = (c: string) => (order.includes(c) ? order.indexOf(c) : order.length);
  const sorted = [...preview.totals].sort((a, b) => rank(a.category) - rank(b.category));
  let total = 0;
  const rows: SplitRow[] = [];
  for (const t of sorted) {
    const h = toHundredths(t.hours) ?? 0;
    if (h === 0) continue;
    total += h;
    rows.push({ label: categoryLabel(t.category), hours: formatHundredths(h) });
  }
  return { rows, total: formatHundredths(total) };
}

/** Days of the preview that carry OT or double time (highlighted in the dialog). */
export function overtimeDays(days: WorkerDaySplit[]): WorkerDaySplit[] {
  return days.filter((d) => (toHundredths(d.ot) ?? 0) > 0 || (toHundredths(d.double_time) ?? 0) > 0);
}

// ---------------------------------------------------------------- client decisions
/** Error message for a Client decision, or null when it may be sent. Rejecting requires a comment. */
export function decisionError(action: ClientDecision, comment: string): string | null {
  if (action === "reject" && comment.trim() === "") return "A comment is required to reject a timesheet.";
  if (comment.length > 4000) return "Keep the comment under 4000 characters.";
  return null;
}

export type BulkConfirm = {
  /** Timesheets that will actually be decided. */
  decidableIds: string[];
  /** Selected ids the server says cannot be decided by this user (skipped). */
  skippedIds: string[];
  totalHours: string;
  canConfirm: boolean;
  summary: string;
};

/** Confirmation model for a bulk approval, from the selection and the server's bulk preview. */
export function bulkConfirmation(selected: string[], preview: ClientBulkPreviewOut | null | undefined): BulkConfirm {
  if (!preview) return { decidableIds: [], skippedIds: [], totalHours: "0.00", canConfirm: false, summary: "Loading preview…" };
  const blocked = new Set(preview.not_decidable);
  const previewIds = new Set(preview.items.map((i) => i.id));
  const decidableIds = selected.filter((id) => previewIds.has(id) && !blocked.has(id));
  const skippedIds = selected.filter((id) => !decidableIds.includes(id));
  const totalHours = formatHundredths(
    preview.items.filter((i) => decidableIds.includes(i.id)).reduce((a, i) => a + (toHundredths(i.total_hours) ?? 0), 0),
  );
  const n = decidableIds.length;
  const summary =
    n === 0
      ? "None of the selected timesheets can be approved by you."
      : `Approve ${n} timesheet${n === 1 ? "" : "s"} totalling ${totalHours} hours.` +
        (skippedIds.length ? ` ${skippedIds.length} will be skipped.` : "");
  return { decidableIds, skippedIds, totalHours, canConfirm: n > 0 && !!preview.preview_hash, summary };
}

/** A fresh Idempotency-Key for one user action. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Human message for a known error code. */
export const ERROR_CODE_LABELS: Record<string, string> = {
  outside_placement_dates: "Outside the placement dates",
  over_24h: "More than 24 hours in a day",
  over_daily_cap: "Above the daily cap",
  invalid_hours: "Invalid hours",
  category_not_enabled: "Category not enabled",
  computed_category: "Overtime is computed automatically",
  not_awaiting_you: "Not awaiting your approval",
  no_email: "Worker has no email",
};
export const codeLabel = (c: string) => ERROR_CODE_LABELS[c] ?? c.replace(/_/g, " ");
