/** Statement line grouping (pure; Decimal-string arithmetic only). */
import { sumDecimals } from "./format";
import type { StatementLineOut } from "./types";

/** Lines grouped by worker with Decimal-string subtotals (no float arithmetic). */
export function groupLines(lines: StatementLineOut[]): { worker: string; lines: StatementLineOut[]; subtotal: string }[] {
  const groups = new Map<string, StatementLineOut[]>();
  for (const ln of lines) {
    const key = ln.worker_name_snapshot || "—";
    groups.set(key, [...(groups.get(key) ?? []), ln]);
  }
  return [...groups.entries()].map(([worker, ls]) => ({ worker, lines: ls, subtotal: sumDecimals(ls.map((l) => l.amount)) }));
}
