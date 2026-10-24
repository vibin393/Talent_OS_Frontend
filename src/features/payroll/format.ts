/**
 * Payroll Export pure helpers (Epic 28): labels, finalize / proceed gating, statutory placeholder columns,
 * decimal-string display and mapping-template validation. No float arithmetic on money.
 */
import { ApiError } from "@/lib/api/errors";
import { formatMoney } from "@/features/expenses/money";
import type {
  CatalogueField,
  ExceptionKind,
  ExceptionsOut,
  MappingColumn,
  PeriodStatus,
  VersionKind,
  VersionOut,
  VersionStatus,
} from "./types";

export const FINALIZE_WORD = "FINALIZE";

/** Statutory columns: always empty -- computed by the Tenant's payroll system, never by Talent OS. */
export const STATUTORY_COLUMNS = [
  { key: "pf_employee", label: "PF (employee)" },
  { key: "pf_employer", label: "PF (employer)" },
  { key: "esi_employee", label: "ESI (employee)" },
  { key: "esi_employer", label: "ESI (employer)" },
  { key: "professional_tax", label: "Professional tax" },
  { key: "tds_salary", label: "TDS (salary)" },
  { key: "other_deductions", label: "Other deductions" },
] as const;
export const STATUTORY_TOOLTIP = "Filled by your payroll system";

/** A statutory placeholder cell is always blank, whatever the row holds. */
export function statutoryCell(): string {
  return "";
}

export const EXCEPTION_LABELS: Record<ExceptionKind, string> = {
  unapproved_timesheets: "Timesheets not yet approved",
  missing_pay_rate: "Placements without a pay rate",
  missing_bank_details: "Workers without verified bank details",
  currency_mismatch: "Items in a currency different from the rate",
};
export const EXCEPTION_LINKS: Record<ExceptionKind, string> = {
  unapproved_timesheets: "/timesheets",
  missing_pay_rate: "/placements",
  missing_bank_details: "/workers",
  currency_mismatch: "/placements",
};
export const BLOCKING_EXCEPTIONS: ExceptionKind[] = ["missing_pay_rate", "missing_bank_details", "currency_mismatch"];

export function periodStatusLabel(s: PeriodStatus): string {
  return s === "locked" ? "Locked" : "Open";
}

export function versionKindLabel(kind: VersionKind, supplementary = false): string {
  if (kind === "preview") return supplementary ? "Supplementary preview" : "Preview";
  return kind === "final" ? "Final" : "Supplementary";
}

export const VERSION_STATUS_LABELS: Record<VersionStatus, string> = {
  building: "Building",
  generated: "Generated",
  finalized: "Finalized",
  processed: "Processed",
  superseded: "Superseded",
};

export function versionStatusColor(s: VersionStatus): "brand" | "success" | "informative" | "subtle" | "warning" {
  if (s === "processed") return "success";
  if (s === "finalized") return "brand";
  if (s === "generated") return "informative";
  if (s === "building") return "warning";
  return "subtle";
}

/** Whether "Generate preview" may run: blocking exceptions need the explicit "proceed excluding" choice. */
export function canGeneratePreview(exceptions: ExceptionsOut | undefined, proceedExcluding: boolean): boolean {
  if (!exceptions) return false;
  return !exceptions.blocking || proceedExcluding;
}

/** The typed confirmation gate of the finalize dialog (exact word, case-sensitive, surrounding spaces ignored). */
export function finalizeConfirmed(typed: string): boolean {
  return typed.trim() === FINALIZE_WORD;
}

export function canFinalize(v: VersionOut | undefined): boolean {
  return !!v && v.kind === "preview" && v.status === "generated" && v.item_count > 0;
}

export function canMarkProcessed(v: VersionOut | undefined): boolean {
  return !!v && v.kind !== "preview" && v.status === "finalized";
}

/** "₹12,345.67 · 3 workers" lines for each currency (never summed across currencies). */
export function totalsLines(v: VersionOut): string[] {
  return Object.entries(v.totals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ccy, t]) => `${formatMoney(t.gross_earnings_inputs, ccy)} gross inputs · ${formatMoney(t.reimbursements_total, ccy)} reimbursements · ${t.workers} worker${t.workers === "1" ? "" : "s"}`);
}

/** Hours / quantities: shown as-is from the decimal string ("7.83"); empty / zero -> "—". */
export function displayHours(value: string | null | undefined): string {
  if (!value) return "—";
  return /^-?0+(\.0+)?$/.test(value) ? "—" : value;
}

export function displayMoney(value: string | null | undefined, currency: string): string {
  return formatMoney(value ?? null, currency);
}

/** Server error -> a payroll-specific sentence. */
export function payrollErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "preview_stale":
        return "Approved items changed since this preview. Regenerate the preview, then finalize.";
      case "pay_period_locked":
        return "This pay period is locked. Generate a supplementary preview instead.";
      case "nothing_to_export":
        return "There is nothing new to export for this period.";
      case "payroll_exceptions":
        return "Resolve the exceptions or choose to proceed excluding them.";
      case "human_only_action":
        return "Only a person can finalize payroll.";
      case "unknown_source_field":
        return "The mapping references a field that does not exist.";
      case "identity_column_required":
        return "Include at least one identity column (Worker ID, name, PAN or bank account).";
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function isStale(error: unknown): boolean {
  return error instanceof ApiError && error.code === "preview_stale";
}

/** Client-side mapping validation (mirrors the server): name, known fields, unique headers, an identity column. */
export function mappingErrors(name: string, columns: MappingColumn[], catalogue: CatalogueField[]): string[] {
  const errors: string[] = [];
  if (!name.trim()) errors.push("Name the mapping.");
  const known = new Set(catalogue.map((c) => c.key));
  const unknown = columns.filter((c) => !known.has(c.source_field));
  if (unknown.length) errors.push(`Unknown fields: ${unknown.map((c) => c.source_field).join(", ")}.`);
  const included = columns.filter((c) => c.include);
  if (!included.length) errors.push("Include at least one column.");
  if (included.some((c) => !c.header.trim())) errors.push("Every included column needs a header.");
  const headers = included.map((c) => c.header.trim().toLowerCase());
  if (new Set(headers).size !== headers.length) errors.push("Column headers must be unique.");
  const identity = new Set(catalogue.filter((c) => c.identity).map((c) => c.key));
  if (!included.some((c) => identity.has(c.source_field))) errors.push("Include at least one identity column.");
  return errors;
}

/** Move a column up / down (keyboard-accessible reorder for the mapping editor). */
export function moveColumn(columns: MappingColumn[], index: number, delta: -1 | 1): MappingColumn[] {
  const target = index + delta;
  if (target < 0 || target >= columns.length) return columns;
  const next = [...columns];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `k-${Date.now()}-${crypto.randomUUID()}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
