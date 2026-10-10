/** Pure view models of tile payloads: KPI values, table columns, chart data. */
import type { TileLink, TileOut } from "@/lib/api/types";
import { bucketLink } from "./links";

export type TileRow = Record<string, unknown>;

export function humanize(value: string): string {
  const text = value.replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : value;
}

export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

/** KPI number with its unit: "42.5%" for percentages; other units are shown as a caption. */
export function kpiText(value: number | null | undefined, unit: string | null | undefined): string {
  const text = formatNumber(value);
  return unit === "%" && text !== "—" ? `${text}%` : text;
}

/** Caption under a KPI number ("hours", "days"); percentages carry their unit inline. */
export function kpiUnitCaption(unit: string | null | undefined): string | null {
  return unit && unit !== "%" ? unit : null;
}

const SAMPLE_NOUNS: Record<string, string> = {
  time_to_first_submission: "demands",
  time_to_fill: "demands",
  db_sourced_submissions: "submissions",
  submission_to_interview: "submissions",
  active_recruiters: "recruiters",
};

/** "n = 14 demands" sample-size note, or null. */
export function sampleNote(tile: Pick<TileOut, "key" | "n">): string | null {
  if (tile.n === null || tile.n === undefined) return null;
  const noun = SAMPLE_NOUNS[tile.key];
  return `n = ${tile.n.toLocaleString()}${noun ? ` ${noun}` : ""}`;
}

export type KpiItem = { key: string; label: string; value: number | null; href: TileLink | null };

function toNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * KPI tiles are either one headline number (with optional detail rows, e.g. SM-2's numerator and
 * denominator) or several sibling counts, each with its own drill-down (`tasks_due`, `sla_risk`,
 * `my_week`): no unit, two or more rows and a row link per row.
 */
export function kpiItems(tile: Pick<TileOut, "rows" | "row_links" | "unit">): KpiItem[] | null {
  const rows = tile.rows ?? [];
  const links = tile.row_links ?? [];
  if (tile.unit || rows.length < 2 || links.length !== rows.length) return null;
  return rows.map((r, i) => ({
    key: String(r.key ?? i),
    label: String(r.label ?? r.key ?? ""),
    value: toNumber(r.value),
    href: links[i] ?? null,
  }));
}

/** Detail lines under a headline KPI ("Demands with a submission: 12"). */
export function kpiDetails(tile: Pick<TileOut, "rows">): { key: string; label: string; value: string }[] {
  return (tile.rows ?? [])
    .filter((r) => typeof r.label === "string")
    .map((r, i) => ({ key: String(r.key ?? i), label: String(r.label), value: formatNumber(toNumber(r.value)) }));
}

// ================================================================ table tiles
export type ColumnKind = "text" | "number" | "percent" | "sla" | "time" | "enum";
export type TableColumn = { key: string; label: string; kind: ColumnKind; primary?: boolean };

const TABLE_COLUMNS: Record<string, TableColumn[]> = {
  my_open_demands: [
    { key: "req_id", label: "REQ", kind: "text", primary: true },
    { key: "title", label: "Title", kind: "text" },
    { key: "client", label: "Client", kind: "text" },
    { key: "sla_status", label: "SLA", kind: "sla" },
    { key: "days_open", label: "Days open", kind: "number" },
    { key: "pipeline_count", label: "Pipeline", kind: "number" },
  ],
  interviews_today: [
    { key: "starts_at", label: "Time", kind: "time", primary: true },
    { key: "candidate", label: "Candidate", kind: "text" },
    { key: "demand_req_id", label: "REQ", kind: "text" },
    { key: "stage_name", label: "Stage", kind: "text" },
    { key: "mode", label: "Mode", kind: "enum" },
    { key: "status", label: "Status", kind: "enum" },
  ],
  recruiter_activity: [
    { key: "name", label: "Recruiter", kind: "text", primary: true },
    { key: "applications_added", label: "Applications", kind: "number" },
    { key: "screenings_completed", label: "Screenings", kind: "number" },
    { key: "submissions_sent", label: "Submissions", kind: "number" },
    { key: "interviews_scheduled", label: "Interviews", kind: "number" },
    { key: "notes_logged", label: "Notes / calls", kind: "number" },
    { key: "emails_sent", label: "Emails", kind: "number" },
  ],
  source_effectiveness: [
    { key: "source", label: "Source", kind: "enum", primary: true },
    { key: "applications", label: "Applications", kind: "number" },
    { key: "submissions", label: "Submissions", kind: "number" },
    { key: "interviews", label: "Interviews", kind: "number" },
    { key: "hires", label: "Hires", kind: "number" },
    { key: "hire_rate", label: "Hire rate", kind: "percent" },
  ],
  demands_by_client: [
    { key: "client", label: "Client", kind: "text", primary: true },
    { key: "open", label: "Open", kind: "number" },
    { key: "on_hold", label: "On hold", kind: "number" },
    { key: "filled", label: "Filled", kind: "number" },
    { key: "positions", label: "Positions", kind: "number" },
    { key: "hires", label: "Hires", kind: "number" },
    { key: "fill_progress", label: "Fill progress", kind: "percent" },
    { key: "submissions", label: "Submissions", kind: "number" },
    { key: "interviews", label: "Interviews", kind: "number" },
  ],
};

const HIDDEN_KEYS = new Set(["id", "key", "client_id", "application_id", "demand_id"]);

/**
 * Columns of a table tile: the known spec for the tile (dropping columns whose values are all null,
 * e.g. interviews when Epic 7 is not installed), or columns inferred from the first row.
 */
export function tableColumns(tileKey: string, rows: readonly TileRow[]): TableColumn[] {
  const spec = TABLE_COLUMNS[tileKey];
  if (spec) {
    return spec.filter((c) => c.primary || rows.length === 0 || rows.some((r) => r[c.key] !== null && r[c.key] !== undefined));
  }
  const first = rows[0] ?? {};
  return Object.keys(first)
    .filter((k) => !HIDDEN_KEYS.has(k))
    .map((k, i) => ({ key: k, label: humanize(k), kind: typeof first[k] === "number" ? "number" : "text", primary: i === 0 }));
}

export function formatCell(value: unknown, kind: ColumnKind, timeZone?: string): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (kind) {
    case "number":
      return typeof value === "number" ? formatNumber(value) : String(value);
    case "percent":
      return typeof value === "number" ? `${formatNumber(value)}%` : String(value);
    case "enum":
    case "sla":
      return humanize(String(value));
    case "time": {
      const d = new Date(String(value));
      if (Number.isNaN(d.getTime())) return String(value);
      try {
        return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", timeZone });
      } catch {
        return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      }
    }
    default:
      return String(value);
  }
}

// ================================================================ charts
export type BarDatum = { key: string; label: string; value: number; pct: number | null; href: TileLink | null };

/** Bars of a breakdown / funnel tile (the funnel carries "% of previous"). */
export function barData(tile: Pick<TileOut, "rows" | "row_links" | "kind">): BarDatum[] {
  return (tile.rows ?? []).map((r, i) => ({
    key: String(r.key ?? i),
    label: String(r.label ?? r.key ?? ""),
    value: toNumber(r.value) ?? 0,
    pct: tile.kind === "funnel" ? toNumber(r.pct_of_previous) : null,
    href: tile.row_links?.[i] ?? null,
  }));
}

/** Bar label: the count, plus "% of previous" on funnels. */
export function barLabel(d: Pick<BarDatum, "value" | "pct">): string {
  return d.pct === null ? formatNumber(d.value) : `${formatNumber(d.value)} (${formatNumber(d.pct)}%)`;
}

export type SeriesPoint = { bucket: string; from: string; to: string; value: number };
export type Series = { key: string; label: string; points: SeriesPoint[]; link: TileLink | null };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseSeries(tile: Pick<TileOut, "series">): Series[] {
  return (tile.series ?? []).filter(isRecord).map((s, i) => ({
    key: String(s.key ?? i),
    label: String(s.label ?? s.key ?? ""),
    link: isRecord(s.link) && typeof s.link.path === "string" ? (s.link as TileLink) : null,
    points: (Array.isArray(s.points) ? s.points : []).filter(isRecord).map((p) => ({
      bucket: String(p.bucket ?? ""),
      from: String(p.from ?? p.bucket ?? ""),
      to: String(p.to ?? p.bucket ?? ""),
      value: toNumber(p.value) ?? 0,
    })),
  }));
}

/** One row per bucket (`{bucket, from, to, <seriesKey>: value}`) for recharts and the table view. */
export function seriesRows(series: readonly Series[]): Record<string, string | number>[] {
  const rows = new Map<string, Record<string, string | number>>();
  for (const s of series) {
    for (const p of s.points) {
      const row = rows.get(p.bucket) ?? { bucket: p.bucket, from: p.from, to: p.to };
      row[s.key] = p.value;
      rows.set(p.bucket, row);
    }
  }
  return [...rows.values()].sort((a, b) => String(a.bucket).localeCompare(String(b.bucket)));
}

/** Drill-down of one bucket of one series. */
export function seriesBucketLink(s: Series, row: { from?: unknown; to?: unknown }): TileLink | null {
  if (!s.link || typeof row.from !== "string" || typeof row.to !== "string") return s.link;
  return bucketLink(s.link, row.from, row.to);
}

/** Axis label of a bucket start date for the granularity ("30 Sep", "Sep 2026"). */
export function bucketLabel(bucket: string, granularity: string | null | undefined): string {
  const d = new Date(`${bucket.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return bucket;
  if (granularity === "month") return d.toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Screen-reader summary of a chart. */
export function chartSummary(tile: Pick<TileOut, "title" | "kind" | "rows" | "series" | "row_links">): string {
  if (tile.kind === "series") {
    const series = parseSeries(tile);
    const parts = series.map((s) => `${s.label} ${s.points.reduce((sum, p) => sum + p.value, 0).toLocaleString()}`);
    const buckets = series[0]?.points.length ?? 0;
    return `${tile.title}: line chart over ${buckets} periods. Totals: ${parts.join(", ") || "no data"}.`;
  }
  const bars = barData({ rows: tile.rows, row_links: tile.row_links, kind: tile.kind });
  const parts = bars.map((b) => `${b.label} ${barLabel(b)}`);
  return `${tile.title}: bar chart. ${parts.join(", ") || "No data"}.`;
}
