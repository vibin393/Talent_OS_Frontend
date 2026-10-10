/** Pure view models of Phase 2 tiles: badges, table columns, breakdown / series chart data. */
import { humanize } from "../tile-format";
import { formatMoney, formatPercent, toChartNumber } from "./money";
import { isMoney, type P2TileOut } from "./types";

export const WIP_DEFINITION = "Approved, not yet invoiced";

export type P2Badge = { key: "estimate" | "reconciling"; label: string; tooltip: string };

/** "Estimate" on WIP tiles, "Reconciling" when served from live facts while a summary issue is open. */
export function tileBadges(tile: Pick<P2TileOut, "estimate" | "source">): P2Badge[] {
  const out: P2Badge[] = [];
  if (tile.estimate) out.push({ key: "estimate", label: "Estimate", tooltip: WIP_DEFINITION });
  if (tile.source === "live") {
    out.push({ key: "reconciling", label: "Reconciling", tooltip: "Shown from live documents while the monthly summary is being reconciled." });
  }
  return out;
}

export type P2ColumnKind = "money" | "percent" | "number" | "text" | "date";
export type P2Column = { key: string; label: string; kind: P2ColumnKind };

const HIDDEN = new Set(["client_id", "key", "highlight"]);
// `pct_used` (P3 project burn) as well as `margin_pct` / `fill_rate`.
const PERCENT_KEYS = /(_pct|_rate)$|^pct_/;

/** Columns of a table tile, from the first rows (money objects, percents, numbers, dates, text). */
export function p2Columns(rows: readonly Record<string, unknown>[]): P2Column[] {
  const keys: string[] = [];
  for (const r of rows.slice(0, 5)) for (const k of Object.keys(r)) if (!HIDDEN.has(k) && !keys.includes(k)) keys.push(k);
  return keys.map((key) => {
    const sample = rows.map((r) => r[key]).find((v) => v !== null && v !== undefined);
    let kind: P2ColumnKind = "text";
    if (isMoney(sample)) kind = "money";
    else if (PERCENT_KEYS.test(key)) kind = "percent";
    else if (typeof sample === "number") kind = "number";
    else if (typeof sample === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sample)) kind = "date";
    return { key, label: key === "pct" ? "%" : humanize(key), kind };
  });
}

export function formatP2Cell(value: unknown, kind: P2ColumnKind): string {
  if (value === null || value === undefined || value === "") return "—";
  if (kind === "money") return isMoney(value) ? formatMoney(value) : "—";
  if (kind === "percent") return formatPercent(value as string | number);
  if (kind === "number") return typeof value === "number" ? value.toLocaleString("en-IN") : String(value);
  return String(value);
}

export type BarPoint = { key: string; label: string; value: number | null; display: string };

/** Breakdown rows -> bar data (money rows plot their amount; the label always carries the text value). */
export function breakdownData(tile: Pick<P2TileOut, "rows">): BarPoint[] {
  return (tile.rows ?? []).map((r, i) => {
    const money = isMoney(r.money) ? r.money : null;
    const value = money ? toChartNumber(money) : toChartNumber(r.value as number | string | null);
    return {
      key: String(r.key ?? i),
      label: String(r.label ?? r.key ?? ""),
      value,
      display: money ? formatMoney(money) : value === null ? "—" : value.toLocaleString("en-IN"),
    };
  });
}

/** Stacked breakdown (e.g. BGV by status x age): one row per category, one numeric key per stack. */
export function stackedData(tile: Pick<P2TileOut, "rows" | "series_keys">): { keys: { key: string; label: string }[]; rows: Record<string, unknown>[] } | null {
  const keys = tile.series_keys ?? null;
  if (!keys || keys.length === 0) return null;
  return { keys, rows: (tile.rows ?? []).map((r) => ({ ...r, label: String(r.label ?? r.key ?? "") })) };
}

/** Series tiles -> recharts rows `{bucket, <seriesKey>: number}` plus display strings per series. */
export function seriesData(tile: Pick<P2TileOut, "series" | "unit">): { keys: { key: string; label: string }[]; rows: Record<string, string | number | null>[] } {
  const series = (tile.series ?? []).filter((s) => !s.masked);
  const buckets: string[] = [];
  for (const s of series) for (const p of s.points) if (!buckets.includes(p.bucket)) buckets.push(p.bucket);
  const rows = buckets.map((bucket) => {
    const row: Record<string, string | number | null> = { bucket };
    for (const s of series) {
      const point = s.points.find((p) => p.bucket === bucket);
      row[s.key] = toChartNumber(point?.value ?? null);
      row[`${s.key}__display`] =
        point?.value === null || point?.value === undefined
          ? "—"
          : tile.unit === "INR"
            ? formatMoney({ amount: String(point.value), currency: "INR" })
            : String(point.value);
    }
    return row;
  });
  return { keys: series.map((s) => ({ key: s.key, label: s.label })), rows };
}
