/**
 * Dashboard filter state (Epic 11, B1): date-range presets resolved in the user's timezone, business
 * units and the selected dashboard, kept in the page URL so a dashboard link is shareable.
 */

export const DATE_PRESETS = ["today", "this_week", "last_7", "last_30", "last_90", "this_quarter", "custom"] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export const PRESET_LABELS: Record<DatePreset, string> = {
  today: "Today",
  this_week: "This week",
  last_7: "Last 7 days",
  last_30: "Last 30 days",
  last_90: "Last 90 days",
  this_quarter: "This quarter",
  custom: "Custom…",
};

export const DEFAULT_PRESET = "last_30" satisfies DatePreset;
/** Backend `DASHBOARD_MAX_RANGE_DAYS`. */
export const MAX_RANGE_DAYS = 366;

export type DateRange = { from: string; to: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Today's calendar date (`YYYY-MM-DD`) in `timeZone` (an invalid zone falls back to the browser's). */
export function todayIn(timeZone: string | undefined, now: Date = new Date()): string {
  const format = (tz: string | undefined) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  try {
    return format(timeZone);
  } catch {
    return format(undefined);
  }
}

function toUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Inclusive number of days in `[from, to]`. */
export function rangeDays(range: DateRange): number {
  return Math.round((toUtc(range.to).getTime() - toUtc(range.from).getTime()) / 86_400_000) + 1;
}

/** The `from`/`to` local dates of a preset, relative to "now" in `timeZone` (ranges end today). */
export function presetRange(preset: Exclude<DatePreset, "custom">, timeZone: string | undefined, now: Date = new Date()): DateRange {
  const today = todayIn(timeZone, now);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "this_week": {
      const weekday = toUtc(today).getUTCDay(); // 0 = Sunday; ISO weeks start on Monday
      return { from: addDays(today, -((weekday + 6) % 7)), to: today };
    }
    case "last_7":
      return { from: addDays(today, -6), to: today };
    case "last_30":
      return { from: addDays(today, -29), to: today };
    case "last_90":
      return { from: addDays(today, -89), to: today };
    case "this_quarter": {
      const [y, m] = today.split("-").map(Number);
      const firstMonth = Math.floor((m - 1) / 3) * 3 + 1;
      return { from: `${y}-${String(firstMonth).padStart(2, "0")}-01`, to: today };
    }
  }
}

/** Validation message for a custom range, or null when it is acceptable. */
export function rangeError(range: DateRange): string | null {
  if (!isIsoDate(range.from) || !isIsoDate(range.to)) return "Pick a start and an end date.";
  if (range.from > range.to) return "The start date must be on or before the end date.";
  if (rangeDays(range) > MAX_RANGE_DAYS) return `Pick a range of at most ${MAX_RANGE_DAYS} days.`;
  return null;
}

export type DashboardParams = {
  /** Selected dashboard key (null: the default one). */
  view: string | null;
  preset: DatePreset;
  /** Only for `custom`. */
  from: string | null;
  to: string | null;
  businessUnitIds: string[];
};

export const EMPTY_DASHBOARD_PARAMS: DashboardParams = {
  view: null,
  preset: DEFAULT_PRESET,
  from: null,
  to: null,
  businessUnitIds: [],
};

type ParamSource = { get(name: string): string | null; getAll(name: string): string[] };

/** Dashboard state from the page URL; malformed values fall back to the defaults. */
export function parseDashboardParams(params: ParamSource): DashboardParams {
  const view = params.get("view");
  const range = params.get("range");
  const from = params.get("from");
  const to = params.get("to");
  let preset = DATE_PRESETS.find((p) => p === range) ?? DEFAULT_PRESET;
  // A shared link with explicit dates (and no preset) is a custom range.
  if ((preset === "custom" || range === null) && isIsoDate(from) && isIsoDate(to)) preset = "custom";
  else if (preset === "custom") preset = DEFAULT_PRESET;
  const bus = [...new Set(params.getAll("bu").flatMap((v) => v.split(",")))].filter((v) => UUID_RE.test(v));
  return {
    view: view && /^[a-z_]{1,40}$/.test(view) ? view : null,
    preset,
    from: preset === "custom" ? from : null,
    to: preset === "custom" ? to : null,
    businessUnitIds: bus,
  };
}

/** Page URL query (without `?`); defaults are omitted. */
export function dashboardParamsToSearch(p: DashboardParams): string {
  const out = new URLSearchParams();
  if (p.view) out.set("view", p.view);
  if (p.preset === "custom" && p.from && p.to) {
    out.set("range", "custom");
    out.set("from", p.from);
    out.set("to", p.to);
  } else if (p.preset !== DEFAULT_PRESET && p.preset !== "custom") {
    out.set("range", p.preset);
  }
  for (const bu of p.businessUnitIds) out.append("bu", bu);
  return out.toString();
}

/** The concrete date range of the dashboard state. */
export function resolveRange(p: DashboardParams, timeZone: string | undefined, now: Date = new Date()): DateRange {
  if (p.preset === "custom" && p.from && p.to) return { from: p.from, to: p.to };
  const preset: Exclude<DatePreset, "custom"> = p.preset === "custom" ? DEFAULT_PRESET : p.preset;
  return presetRange(preset, timeZone, now);
}

/** Query string for `GET /dashboards/{d}/tiles/{t}`. */
export function tileQuery(range: DateRange, businessUnitIds: readonly string[], refresh = false): string {
  const q = new URLSearchParams({ from: range.from, to: range.to });
  for (const bu of businessUnitIds) q.append("business_unit_ids", bu);
  if (refresh) q.set("refresh", "true");
  return q.toString();
}
