/**
 * Pure helpers of the workforce planning UI (Epic 44). Money is a decimal string end to end: inputs are
 * validated and normalised as text (never through `parseFloat`), and only formatted for display.
 */
import { formatMoney } from "@/features/commercials/format";
import type {
  ActualRow,
  ChangeKind,
  DiffLine,
  DiffValue,
  ForecastIn,
  ForecastStatus,
  LineRateUnit,
  LineType,
  PlanStatus,
  SlotOut,
  SlotStatus,
  WorkMode,
} from "./types";

export type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";

export const PERM_READ = "workforce_plan:read";
export const PERM_WRITE = "workforce_plan:write";
export const PERM_APPROVE = "workforce_plan:approve";
export const PERM_DEMAND_CREATE = "demand:create";
export const PORTAL_PERM_FORECASTS = "forecasts:submit";

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  draft: "Draft",
  budgeted: "Budgeted",
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  revision_draft: "Revision draft",
};

export const PLAN_STATUS_COLORS: Record<PlanStatus, BadgeColor> = {
  draft: "informative",
  budgeted: "brand",
  pending_approval: "warning",
  approved: "success",
  rejected: "danger",
  revision_draft: "important",
};

export const SLOT_STATUS_LABELS: Record<SlotStatus, string> = {
  open: "Open",
  requisitioned: "Requisitioned",
  filled: "Filled",
  cancelled: "Cancelled",
};

export const SLOT_STATUS_COLORS: Record<SlotStatus, BadgeColor> = {
  open: "informative",
  requisitioned: "warning",
  filled: "success",
  cancelled: "subtle",
};

export const LINE_TYPE_LABELS: Record<LineType, string> = {
  new: "New",
  replacement: "Replacement",
  project: "Project",
  recurring: "Recurring",
};

export const WORK_MODE_LABELS: Record<WorkMode, string> = { onsite: "Onsite", remote: "Remote", hybrid: "Hybrid" };

export const RATE_UNIT_LABELS: Record<LineRateUnit, string> = { hour: "per hour", day: "per day", month: "per month", annual: "per year" };

export const CHANGE_KIND_LABELS: Record<ChangeKind, string> = {
  unchanged: "Unchanged",
  added: "Added",
  modified: "Modified",
  removed: "Removed",
};

export const CHANGE_KIND_COLORS: Record<ChangeKind, BadgeColor> = {
  unchanged: "subtle",
  added: "success",
  modified: "warning",
  removed: "danger",
};

export const FORECAST_STATUS_LABELS: Record<ForecastStatus, string> = {
  submitted: "Submitted",
  in_review: "In review",
  approved: "Approved",
  declined: "Declined",
};

export const FORECAST_STATUS_COLORS: Record<ForecastStatus, BadgeColor> = {
  submitted: "informative",
  in_review: "warning",
  approved: "success",
  declined: "danger",
};

// ---------------------------------------------------------------- lifecycle
export type PlanActionKey = "budget" | "unbudget" | "submit" | "start-revision" | "discard-revision" | "reopen";
export type PlanActionDef = { action: PlanActionKey; label: string; primary?: boolean; confirm?: string };

/** Header actions available for a plan in `status` (the server re-checks every transition). */
export function planActions(status: PlanStatus, canWrite: boolean): PlanActionDef[] {
  if (!canWrite) return [];
  switch (status) {
    case "draft":
      return [{ action: "budget", label: "Mark budgeted", primary: true }];
    case "budgeted":
      return [
        { action: "submit", label: "Submit for approval", primary: true },
        { action: "unbudget", label: "Back to draft" },
      ];
    case "rejected":
      return [{ action: "reopen", label: "Reopen" }];
    case "approved":
      return [{ action: "start-revision", label: "Start revision", primary: true }];
    case "revision_draft":
      return [
        { action: "submit", label: "Submit revision", primary: true },
        { action: "discard-revision", label: "Discard revision", confirm: "All changes in this revision will be discarded." },
      ];
    default:
      return [];
  }
}

// ---------------------------------------------------------------- months
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonth(value: string): boolean {
  return MONTH_RE.test(value.trim());
}

/** `YYYY-MM` + `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const m = MONTH_RE.exec(month.trim());
  if (!m) throw new Error(`Not a month: ${month}`);
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + delta;
  const y = Math.floor(total / 12);
  const mm = total - y * 12 + 1;
  return `${String(y).padStart(4, "0")}-${String(mm).padStart(2, "0")}`;
}

/** Whole months from the month of ISO date `from` to the month of `to` (day ignored). */
export function monthOffset(from: string, to: string): number {
  const a = /^(\d{4})-(\d{2})/.exec(from);
  const b = /^(\d{4})-(\d{2})/.exec(to);
  if (!a || !b) throw new Error("Not an ISO date");
  return Number(b[1]) * 12 + Number(b[2]) - (Number(a[1]) * 12 + Number(a[2]));
}

/** On "copy plan": a line month moves by the offset between the old and the new plan start. */
export function copyShiftMonth(lineMonth: string, oldPeriodStart: string, newPeriodStart: string): string {
  return shiftMonth(lineMonth, monthOffset(oldPeriodStart, newPeriodStart));
}

/** Last day of a month-shifted copy's period, for the copy dialog preview (keeps the same day-of-month when possible). */
export function copyPeriodEnd(oldStart: string, oldEnd: string, newStart: string): string {
  const shifted = shiftMonth(oldEnd.slice(0, 7), monthOffset(oldStart, newStart));
  const [y, m] = shifted.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Math.min(Number(oldEnd.slice(8, 10)) || 1, lastDay);
  return `${shifted}-${String(day).padStart(2, "0")}`;
}

/** "2026-10" -> "Oct 2026". */
export function formatMonth(month: string | null | undefined): string {
  if (!month) return "—";
  const m = MONTH_RE.exec(month);
  if (!m) return month;
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(m[2]) - 1]} ${m[1]}`;
}

// ---------------------------------------------------------------- money
export type MoneyParse = { ok: true; value: string | null } | { ok: false; error: string };

const MAX_INT_DIGITS = 16;

/**
 * Validate a typed amount and normalise it to a 2-dp decimal string ("1,200.5" -> "1200.50"); empty -> null.
 * Pure string handling: the value sent to the API is never a binary float.
 */
export function normaliseMoney(input: string | null | undefined): MoneyParse {
  const raw = (input ?? "").trim().replace(/[,\s_]/g, "");
  if (raw === "") return { ok: true, value: null };
  if (raw.startsWith("-")) return { ok: false, error: "Amount cannot be negative" };
  const m = /^(\d*)(?:\.(\d*))?$/.exec(raw);
  if (!m || (m[1] === "" && (m[2] ?? "") === "")) return { ok: false, error: "Enter an amount like 1200.50" };
  const frac = m[2] ?? "";
  if (frac.length > 2) return { ok: false, error: "At most 2 decimal places" };
  const int = m[1].replace(/^0+(?=\d)/, "") || "0";
  if (int.length > MAX_INT_DIGITS) return { ok: false, error: "Amount too large" };
  return { ok: true, value: `${int}.${frac.padEnd(2, "0")}` };
}

/** Money for display; a masked (null) amount shows "—". */
export function displayMoney(value: string | null | undefined, currency: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return formatMoney(value, currency);
}

// ---------------------------------------------------------------- revisions diff
export const DIFF_FIELD_LABELS: Record<string, string> = {
  role_title: "Role",
  skills: "Skills",
  headcount: "Headcount",
  line_type: "Type",
  location_text: "Location",
  work_mode: "Work mode",
  start_month: "Start month",
  end_month: "End month",
  period_start: "Start",
  period_end: "End",
  budget_amount: "Budget",
  bill_rate_amount: "Bill rate",
  rate_unit: "Rate unit",
  project_role_id: "Project role",
  notes: "Notes",
};

export const MONEY_FIELDS = new Set(["budget_amount", "bill_rate_amount"]);

function isSkillValue(v: DiffValue): v is { [key: string]: DiffValue } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** One snapshot value as text (money masked as "—", skills as "Java (4), Spring"). */
export function formatDiffValue(field: string, value: DiffValue | undefined, currency?: string): string {
  if (value === undefined || value === null || value === "") return "—";
  if (MONEY_FIELDS.has(field)) return displayMoney(String(value), currency);
  if (field === "skills" && Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value
      .map((s) => {
        if (!isSkillValue(s)) return String(s);
        const name = typeof s.name === "string" ? s.name : String(s.skill_key ?? "?");
        return s.min_proficiency ? `${name} (${String(s.min_proficiency)})` : name;
      })
      .join(", ");
  }
  if (field === "line_type" && typeof value === "string") return LINE_TYPE_LABELS[value as LineType] ?? value;
  if (field === "work_mode" && typeof value === "string") return WORK_MODE_LABELS[value as WorkMode] ?? value;
  if ((field === "start_month" || field === "end_month") && typeof value === "string") return formatMonth(value.slice(0, 7));
  if (Array.isArray(value) || typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export type DiffRow = { field: string; label: string; before: string; after: string };

const SUMMARY_FIELDS = ["role_title", "headcount", "start_month", "budget_amount"];

/** The before -> after rows of a changed line (added / removed lines show their key fields against "—"). */
export function diffRows(line: DiffLine, currency?: string): DiffRow[] {
  let fields = line.changed_fields;
  if (fields.length === 0 && (line.change_kind === "added" || line.change_kind === "removed")) {
    const snap = line.after ?? line.before ?? {};
    fields = SUMMARY_FIELDS.filter((f) => f in snap);
  }
  return fields.map((field) => ({
    field,
    label: DIFF_FIELD_LABELS[field] ?? field.replace(/_/g, " "),
    before: line.change_kind === "added" ? "—" : formatDiffValue(field, line.before?.[field], currency),
    after: line.change_kind === "removed" ? "—" : formatDiffValue(field, line.after?.[field], currency),
  }));
}

/** Only the lines that changed in a revision. */
export function changedDiffLines(lines: readonly DiffLine[]): DiffLine[] {
  return lines.filter((l) => l.change_kind !== "unchanged");
}

// ---------------------------------------------------------------- slots
export function canConvertSlot(slot: Pick<SlotOut, "status" | "demand_id">): boolean {
  return slot.status === "open" && !slot.demand_id;
}

export function canCancelSlot(slot: Pick<SlotOut, "status">): boolean {
  return slot.status === "open" || slot.status === "requisitioned";
}

// ---------------------------------------------------------------- plan vs actual
/** Bar-chart rows: planned vs filled and budget vs committed (money as numbers for drawing only). */
export function actualsChartRows(rows: readonly ActualRow[], groupBy: "line" | "month") {
  return rows.map((r) => ({
    label: groupBy === "month" ? formatMonth(r.month) : (r.role_title ?? r.key),
    planned: r.planned,
    filled: r.filled,
    budget: r.budget === null ? null : Number(r.budget),
    committed: r.committed === null ? null : Number(r.committed),
  }));
}

/** Variance tone: negative variance (over budget) is an error. */
export function varianceTone(variance: string | null): "danger" | "success" | "neutral" {
  if (variance === null || variance === "") return "neutral";
  const t = variance.trim();
  if (t.startsWith("-") && /[1-9]/.test(t)) return "danger";
  return /[1-9]/.test(t) ? "success" : "neutral";
}

/** Latest predicted fill date among a row's demands (today + predicted days), or null. */
export function latestPredictedFill(predictedDays: readonly (string | null | undefined)[], today: Date = new Date()): string | null {
  let best: number | null = null;
  for (const d of predictedDays) {
    if (d === null || d === undefined || d === "") continue;
    const n = Number(d);
    if (!Number.isFinite(n)) continue;
    if (best === null || n > best) best = n;
  }
  if (best === null) return null;
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + Math.ceil(best));
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- client forecast form
export type ForecastFormLine = {
  role_title: string;
  skills: string;
  headcount: string;
  location_text: string;
  planned_start_month: string;
  notes: string;
};

export type ForecastForm = { name: string; period_start: string; period_end: string; lines: ForecastFormLine[] };

export const BLANK_FORECAST_LINE: ForecastFormLine = {
  role_title: "",
  skills: "",
  headcount: "1",
  location_text: "",
  planned_start_month: "",
  notes: "",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validate the client forecast form; returns field errors (`lines.<i>.<field>`) and the request body when valid. */
export function validateForecast(form: ForecastForm): { errors: Record<string, string>; body: ForecastIn | null } {
  const errors: Record<string, string> = {};
  const name = form.name.trim();
  if (!name) errors.name = "Enter a name";
  else if (name.length > 200) errors.name = "At most 200 characters";
  if (!ISO_DATE.test(form.period_start)) errors.period_start = "Enter a start date";
  if (!ISO_DATE.test(form.period_end)) errors.period_end = "Enter an end date";
  else if (ISO_DATE.test(form.period_start) && form.period_end <= form.period_start) errors.period_end = "End must be after the start";
  if (form.lines.length === 0) errors.lines = "Add at least one role";
  if (form.lines.length > 200) errors.lines = "At most 200 roles";
  form.lines.forEach((l, i) => {
    if (!l.role_title.trim()) errors[`lines.${i}.role_title`] = "Enter a role";
    const hc = l.headcount.trim();
    if (!/^\d+$/.test(hc) || Number(hc) < 1 || Number(hc) > 500) errors[`lines.${i}.headcount`] = "1 to 500";
    if (!isMonth(l.planned_start_month)) errors[`lines.${i}.planned_start_month`] = "Use YYYY-MM";
  });
  if (Object.keys(errors).length) return { errors, body: null };
  return {
    errors,
    body: {
      name,
      period_start: form.period_start,
      period_end: form.period_end,
      lines: form.lines.map((l) => ({
        role_title: l.role_title.trim(),
        skills: splitSkills(l.skills).map((s) => ({ name: s })),
        headcount: Number(l.headcount.trim()),
        location_text: l.location_text.trim() || null,
        planned_start_month: l.planned_start_month.trim(),
        notes: l.notes.trim() || null,
      })),
    },
  };
}

export function splitSkills(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of text.split(/[,;]/)) {
    const t = s.trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out;
}
