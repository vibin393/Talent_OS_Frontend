/** Cell formatting for report lists, driven by the API column spec (`type`, `masked`). */
import type { ReportColumnOut } from "@/lib/api/types";

/** Columns shown in the grid (and sent as the export's visible columns): internal ids are hidden. */
export function visibleColumns(columns: readonly ReportColumnOut[]): ReportColumnOut[] {
  return columns.filter((c) => c.type !== "uuid" && !c.key.endsWith("_key"));
}

function humanize(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function formatReportCell(value: unknown, column: Pick<ReportColumnOut, "type">): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (column.type) {
    case "money": {
      if (!isRecord(value)) return String(value);
      const n = Number(value.amount);
      const amount = Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value.amount);
      return value.currency ? `${String(value.currency)} ${amount}` : amount;
    }
    case "int":
    case "decimal": {
      const n = Number(value);
      return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(value);
    }
    case "datetime": {
      const d = new Date(String(value));
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    }
    case "date": {
      const s = String(value);
      const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
      return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { dateStyle: "medium" });
    }
    case "enum":
      return humanize(String(value));
    case "bool":
    case "boolean":
      return value ? "Yes" : "No";
    default:
      return Array.isArray(value) ? value.join("; ") : String(value);
  }
}

/** Row link: the demand pipeline for applications, the candidate / demand otherwise when known. */
/** Epic 34: detail routes of the Phase 2 list kinds. */
const P2_DETAIL_PATHS: Record<string, string> = {
  leads: "/leads",
  opportunities: "/opportunities",
  vendors: "/vendors",
  placements: "/placements",
  timesheets: "/timesheets",
  expense_claims: "/expenses",
  invoices: "/billing/invoices",
  bgv_cases: "/bgv",
};

export function reportRowHref(kind: string, row: Record<string, unknown>): string | null {
  const demand = typeof row.demand_id === "string" ? row.demand_id : null;
  if (kind === "applications" && demand) return `/demands/${demand}?tab=pipeline`;
  const id = typeof row.id === "string" ? encodeURIComponent(row.id) : null;
  const detail = P2_DETAIL_PATHS[kind];
  return id && detail ? `${detail}/${id}` : null;
}

export function candidateHref(row: Record<string, unknown>): string | null {
  return typeof row.candidate_id === "string" ? `/candidates/${row.candidate_id}` : null;
}
