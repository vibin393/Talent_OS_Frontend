/** Pure helpers of the executive grid (months x metrics). */
import { formatMoney, formatPercent, parseDecimal } from "./money";
import { type ExecCell, type ExecRow, isMoney } from "./types";

export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** Display text of a cell; negatives are wrapped in parentheses. Masked rows show "—". */
export function cellText(row: Pick<ExecRow, "kind" | "masked">, cell: Pick<ExecCell, "value">): string {
  const v = cell.value;
  if (row.masked || v === null || v === undefined) return "—";
  if (row.kind === "money") return isMoney(v) ? formatMoney(v, "parens") : "—";
  if (row.kind === "percent") return formatPercent(v as string | number, "parens");
  if (row.kind === "number") {
    const d = parseDecimal(String(v));
    return d ? `${d.negative ? "(" : ""}${d.integer}.${d.fraction}${d.negative ? ")" : ""}` : "—";
  }
  return typeof v === "number" ? v.toLocaleString("en-IN") : String(v);
}

/** Drill-down href of a cell (the owning list for that month and legal entity), or null. */
export function cellHref(rowKey: string, month: string, legalEntityId: string): string | null {
  const from = month.slice(0, 10);
  const to = monthEnd(month);
  const le = encodeURIComponent(legalEntityId);
  switch (rowKey) {
    case "revenue":
    case "margin":
    case "margin_pct":
      return `/reports/invoices?legal_entity_ids=${le}&from=${from}&to=${to}`;
    case "placements_started":
    case "workers_on_billing":
      return `/reports/placements?legal_entity_ids=${le}&from=${from}&to=${to}`;
    case "overdue_ar":
    case "dso":
      return `/receivables/aging?legal_entity_id=${le}&as_of=${to}`;
    case "pipeline":
      return "/reports/opportunities";
    default:
      return null;
  }
}

export type BadgeColor = "success" | "warning" | "danger" | "informative";

/** Margin % colour band (tokens via Badge colour only; the text always carries the value). */
export function marginColor(value: unknown): BadgeColor {
  if (value === null || value === undefined) return "informative";
  const n = Number(value);
  if (!Number.isFinite(n)) return "informative";
  if (n >= 20) return "success";
  if (n >= 10) return "warning";
  return "danger";
}

export function hasLiveCells(rows: readonly ExecRow[]): boolean {
  return rows.some((r) => r.cells.some((c) => c.source === "live"));
}
