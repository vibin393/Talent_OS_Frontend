/** Chart rows for the Sales dashboard: one series per currency (pure, unit-tested). */
import { parseDecimal } from "../format";
import type { CurrencyTotal } from "../types";

export type ChartSeries = { key: string; label: string; currency: string; measure: "estimated" | "weighted" };
export type ChartRow = { key: string; label: string; count: number } & Record<string, string | number>;

/** Currencies present across buckets, in first-seen order. */
export function currenciesOf(buckets: readonly { totals: readonly CurrencyTotal[] }[]): string[] {
  const out: string[] = [];
  for (const b of buckets) for (const t of b.totals) if (!out.includes(t.currency)) out.push(t.currency);
  return out;
}

/** Series per currency and measure, e.g. "INR open" / "INR weighted". */
export function seriesFor(currencies: readonly string[], measures: readonly ("estimated" | "weighted")[]): ChartSeries[] {
  return currencies.flatMap((c) =>
    measures.map((m) => ({ key: `${c}_${m}`, label: `${c} ${m === "estimated" ? "open" : "weighted"}`, currency: c, measure: m })),
  );
}

/** Rows keyed by series (`INR_weighted: 400000`), parsed from decimal strings. */
export function chartRows(
  buckets: readonly { key: string; label: string; count: number; totals: readonly CurrencyTotal[] }[],
  series: readonly ChartSeries[],
): ChartRow[] {
  return buckets.map((b) => {
    const row: ChartRow = { key: b.key, label: b.label, count: b.count };
    for (const s of series) {
      const t = b.totals.find((x) => x.currency === s.currency);
      row[s.key] = parseDecimal(t?.[s.measure]) ?? 0;
    }
    return row;
  });
}
