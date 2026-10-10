/** Pure form state for the SLA settings page (targets and business calendar). */
import type {
  BusinessCalendarIn,
  BusinessCalendarOut,
  DemandPriority,
  SlaMilestone,
  SlaTargetIn,
  SlaTargetOut,
} from "@/lib/api/types";

export type TargetRow = {
  milestone: SlaMilestone;
  priority: DemandPriority | null;
  targetHours: string;
  clock: "business" | "calendar";
  atRisk: string;
};

export function targetRows(targets: readonly SlaTargetOut[]): TargetRow[] {
  return targets.map((t) => ({
    milestone: t.milestone,
    priority: t.priority,
    targetHours: String(Number(t.target_hours)),
    clock: t.clock,
    atRisk: String(t.at_risk_percent),
  }));
}

/** Row index -> message. Duplicate (milestone, priority) pairs are errors. */
export function validateTargets(rows: readonly TargetRow[]): Record<number, string> {
  const errors: Record<number, string> = {};
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const hours = Number(r.targetHours);
    const risk = Number(r.atRisk);
    const key = `${r.milestone}:${r.priority ?? "any"}`;
    if (!r.targetHours.trim() || !Number.isFinite(hours) || hours <= 0 || hours > 100000) errors[i] = "Target must be more than 0 hours";
    else if (!/^\d+$/.test(r.atRisk.trim()) || risk < 1 || risk > 99) errors[i] = "At risk must be 1–99 %";
    else if (seen.has(key)) errors[i] = "This milestone and priority already has a target";
    seen.add(key);
  });
  return errors;
}

export function targetsIn(rows: readonly TargetRow[]): SlaTargetIn[] {
  return rows.map((r) => ({
    milestone: r.milestone,
    priority: r.priority,
    target_hours: r.targetHours.trim(),
    clock: r.clock,
    at_risk_percent: Number(r.atRisk),
  }));
}

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];
export const DAY_LABELS: Record<Day, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export type CalendarDraft = {
  days: Record<string, { working: boolean; start: string; end: string }>;
  holidays: string[];
};

export function calendarDraft(c: BusinessCalendarOut): CalendarDraft {
  const days: CalendarDraft["days"] = {};
  for (const d of DAYS) {
    const w = c.work_week[d];
    days[d] = w ? { working: true, start: w.start, end: w.end } : { working: false, start: "09:00", end: "18:00" };
  }
  return { days, holidays: [...c.holidays].sort() };
}

/** Message for an invalid calendar, or null. */
export function validateCalendar(d: CalendarDraft): string | null {
  const working = DAYS.filter((day) => d.days[day].working);
  if (working.length === 0) return "Choose at least one working day.";
  for (const day of working) {
    const { start, end } = d.days[day];
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return `Enter start and end times for ${DAY_LABELS[day]}.`;
    if (end !== "24:00" && end <= start) return `${DAY_LABELS[day]} must end after it starts.`;
  }
  return null;
}

export function calendarIn(d: CalendarDraft): BusinessCalendarIn {
  const work_week: BusinessCalendarIn["work_week"] = {};
  for (const day of DAYS) {
    const w = d.days[day];
    if (w.working) work_week[day] = { start: w.start, end: w.end };
  }
  return { work_week, holidays: d.holidays };
}
