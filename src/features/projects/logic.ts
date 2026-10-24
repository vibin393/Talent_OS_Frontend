/**
 * Pure helpers of the projects UI (Epic 45): the resource-timeline-to-grid transform, status labels and the
 * allowed actions per status. No React here so the logic is unit-testable in the node Vitest environment.
 */
import type {
  BudgetDimension,
  DeliverableStatus,
  PortalProjectDeliverable,
  ProjectRoleStatus,
  ProjectStatus,
  ResourceTimeline,
  RiskKind,
  WorkerSplit,
} from "./types";

export type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Draft",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};
export const PROJECT_STATUS_COLORS: Record<ProjectStatus, BadgeColor> = {
  draft: "informative",
  active: "success",
  on_hold: "warning",
  completed: "brand",
  cancelled: "subtle",
};

/** Transitions offered in the project header (the backend remains the authority). */
export const PROJECT_TRANSITIONS: Record<ProjectStatus, { to: ProjectStatus; label: string }[]> = {
  draft: [
    { to: "active", label: "Activate" },
    { to: "cancelled", label: "Cancel project" },
  ],
  active: [
    { to: "on_hold", label: "Put on hold" },
    { to: "completed", label: "Complete" },
    { to: "cancelled", label: "Cancel project" },
  ],
  on_hold: [
    { to: "active", label: "Resume" },
    { to: "cancelled", label: "Cancel project" },
  ],
  completed: [],
  cancelled: [],
};

export const ROLE_STATUS_LABELS: Record<ProjectRoleStatus, string> = { open: "Open", filled: "Filled", closed: "Closed", cancelled: "Cancelled" };
export const ROLE_STATUS_COLORS: Record<ProjectRoleStatus, BadgeColor> = { open: "warning", filled: "success", closed: "subtle", cancelled: "subtle" };

export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  submitted: "Awaiting acceptance",
  accepted: "Accepted",
  rejected: "Rejected",
  cancelled: "Cancelled",
};
export const DELIVERABLE_STATUS_COLORS: Record<DeliverableStatus, BadgeColor> = {
  planned: "informative",
  in_progress: "brand",
  submitted: "warning",
  accepted: "success",
  rejected: "danger",
  cancelled: "subtle",
};

export type DeliverableAction = "start" | "submit" | "cancel" | "record_acceptance" | "record_rejection";

/** Actions a User may take on a deliverable in `status`. */
export function deliverableActions(status: DeliverableStatus): DeliverableAction[] {
  switch (status) {
    case "planned":
      return ["start", "cancel"];
    case "in_progress":
      return ["submit", "cancel"];
    case "rejected":
      return ["start", "cancel"];
    case "submitted":
      return ["record_acceptance", "record_rejection", "cancel"];
    default:
      return [];
  }
}

export const RISK_LABELS: Record<RiskKind, string> = {
  deliverable_overdue: "Deliverable overdue",
  role_unfilled: "Role unfilled",
  over_allocation: "Over-allocation",
  budget_threshold: "Budget threshold",
  sow_ending: "SOW ending",
};

export const BUDGET_DIMENSIONS: BudgetDimension[] = ["hours", "cost", "revenue"];
export const BUDGET_DIMENSION_LABELS: Record<BudgetDimension, string> = { hours: "Hours", cost: "Cost", revenue: "Revenue" };

/** A decimal-string percentage as a 0..1 ratio for a `ProgressBar` (clamped; null when unknown). */
export function pctRatio(pct: string | null | undefined): number | null {
  if (pct === null || pct === undefined || pct === "") return null;
  const n = Number(pct);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n / 100));
}

/** Colour of a burn bar: brand below 80 %, warning from 80 %, error from 100 %. */
export function burnColor(pct: string | null | undefined): "brand" | "warning" | "error" {
  const n = Number(pct ?? 0);
  if (n >= 100) return "error";
  if (n >= 80) return "warning";
  return "brand";
}

// ---------------------------------------------------------------- acceptance
/** Validation of the "record acceptance" form: evidence is mandatory. */
export function acceptanceError(file: File | Blob | null | undefined): string | null {
  if (!file) return "Attach the client's acceptance evidence (email, signed note).";
  if (file.size === 0) return "The evidence file is empty.";
  return null;
}

/** Validation of a rejection reason (the API requires at least 3 characters). */
export function rejectionError(reason: string): string | null {
  return reason.trim().length >= 3 ? null : "Give a reason of at least 3 characters.";
}

/** Client Portal: deliverables awaiting acceptance first, then by due date. */
export function sortPortalDeliverables<T extends Pick<PortalProjectDeliverable, "status" | "due_date">>(items: readonly T[]): T[] {
  const rank = (s: string) => (s === "submitted" ? 0 : s === "in_progress" || s === "planned" ? 1 : 2);
  return [...items].sort((a, b) => rank(a.status) - rank(b.status) || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
}

// ---------------------------------------------------------------- resource timeline grid
const DAY = 86_400_000;

function parseIso(d: string): number {
  return Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
}
function toIso(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** Monday of the ISO week containing `iso`. */
export function weekStart(iso: string): string {
  const t = parseIso(iso);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // Monday = 0
  return toIso(t - dow * DAY);
}

/** Week starts (Mondays) covering `from`..`to` inclusive. */
export function weeksBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const end = parseIso(to);
  for (let t = parseIso(weekStart(from)); t <= end && out.length < 104; t += 7 * DAY) out.push(toIso(t));
  return out;
}

/** `iso` plus `days` days. */
export function addDays(iso: string, days: number): string {
  return toIso(parseIso(iso) + days * DAY);
}

export type CellState = "empty" | "ok" | "gap" | "over";
export type TimelineCell = { week: string; state: CellState; text: string; split: WorkerSplit[] };
export type TimelineRow = { kind: "role" | "worker"; id: string; label: string; cells: TimelineCell[] };

function overlaps(segStart: string, segEnd: string, week: string): boolean {
  const ws = parseIso(week);
  const we = ws + 6 * DAY;
  return parseIso(segStart) <= we && parseIso(segEnd) >= ws;
}

function fmtNum(v: string | number): string {
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : String(v);
}

/**
 * Rows of the role × week grid. A role cell is a `gap` when any overlapping segment is a gap (warning colour);
 * a Worker cell is `over` when any overlapping segment exceeds 100 % (danger colour, tooltip lists the split).
 */
export function buildTimelineGrid(tl: ResourceTimeline, weeks: readonly string[] = weeksBetween(tl.from_date, tl.to_date)): TimelineRow[] {
  const roles: TimelineRow[] = tl.roles.map((r) => ({
    kind: "role",
    id: r.project_role_id,
    label: `${r.title} (${r.headcount})`,
    cells: weeks.map((week) => {
      const segs = r.segments.filter((s) => overlaps(s.start, s.end, week));
      if (!segs.length) return { week, state: "empty" as const, text: "", split: [] };
      const gap = segs.find((s) => s.gap);
      const shown = gap ?? segs[0];
      return { week, state: gap ? ("gap" as const) : ("ok" as const), text: `${fmtNum(shown.assigned_fte)}/${shown.headcount}`, split: [] };
    }),
  }));
  const workers: TimelineRow[] = tl.workers.map((w) => ({
    kind: "worker",
    id: w.placement_id,
    label: w.worker_name ?? "Worker",
    cells: weeks.map((week) => {
      const segs = w.segments.filter((s) => overlaps(s.start, s.end, week));
      if (!segs.length) return { week, state: "empty" as const, text: "", split: [] };
      const peak = segs.reduce((a, b) => (Number(b.total_pct) > Number(a.total_pct) ? b : a)); // NOSONAR
      const over = segs.find((s) => s.over);
      const shown = over ?? peak;
      return { week, state: over ? ("over" as const) : ("ok" as const), text: `${fmtNum(shown.total_pct)}%`, split: shown.split };
    }),
  }));
  return [...roles, ...workers];
}

/** Tooltip text of an over-allocated cell: "Project A 60% · Project B 50%". */
export function splitText(split: readonly WorkerSplit[]): string {
  return split.map((s) => `${s.project_name} ${fmtNum(s.allocation_pct)}%`).join(" · ");
}

// ---------------------------------------------------------------- budget bar
export type BurnScale = { actual: number; mark80: number | null; mark100: number | null; forecast: number | null };

/**
 * Positions (0..1 of the bar width) of the actual fill, the 80 % / 100 % budget markers and the forecast
 * marker. The bar spans the largest of budget × 1.2, actual and forecast; null when there is nothing to draw.
 */
export function burnScale(actual: string, budget: string | null, forecast: string | null): BurnScale | null {
  const a = Math.max(0, Number(actual) || 0);
  const b = budget !== null && Number(budget) > 0 ? Number(budget) : null;
  const f = forecast !== null && Number.isFinite(Number(forecast)) && Number(forecast) > 0 ? Number(forecast) : null;
  const max = Math.max(b !== null ? b * 1.2 : 0, a, f ?? 0);
  if (max <= 0) return null;
  return {
    actual: a / max,
    mark80: b !== null ? (b * 0.8) / max : null,
    mark100: b !== null ? b / max : null,
    forecast: f !== null ? f / max : null,
  };
}
