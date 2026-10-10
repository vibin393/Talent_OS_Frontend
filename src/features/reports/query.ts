/**
 * Report list pages (Epic 11, B2): the four drill-down kinds, their filter params (mirroring the
 * backend filter models), and the mapping URL <-> state <-> API query / export filters.
 */
import { pageParams } from "@/features/admin/query";
import { FROM_DASHBOARD_PARAM, FROM_DASHBOARD_VALUE } from "@/features/dashboards/links";

export const P1_REPORT_KINDS = ["applications", "submissions", "interviews", "offers"] as const;
/** Epic 34: Phase 2 list kinds (`/reports/lists/{kind}`). */
export const P2_REPORT_KINDS = [
  "leads",
  "opportunities",
  "vendors",
  "vendor_submissions",
  "placements",
  "timesheets",
  "expense_claims",
  "invoices",
  "payments",
  "bgv_cases",
] as const;
export const REPORT_KINDS = [...P1_REPORT_KINDS, ...P2_REPORT_KINDS] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export function isReportKind(value: string): value is ReportKind {
  return (REPORT_KINDS as readonly string[]).includes(value);
}

export const REPORT_LABELS: Record<ReportKind, string> = {
  applications: "Applications",
  submissions: "Submissions",
  interviews: "Interviews",
  offers: "Offers",
  leads: "Leads",
  opportunities: "Opportunities",
  vendors: "Vendors",
  vendor_submissions: "Vendor submissions",
  placements: "Placements",
  timesheets: "Timesheets",
  expense_claims: "Expense claims",
  invoices: "Invoices",
  payments: "Payments",
  bgv_cases: "BGV cases",
};

/** Finance lists whose money columns need `report:finance_export` (hidden otherwise). */
export const FINANCE_REPORT_KINDS: readonly ReportKind[] = ["invoices", "payments", "expense_claims"];

/** The read permission of each kind (the export also needs it). */
export const REPORT_READ_PERMISSION: Record<ReportKind, string> = {
  applications: "application:read",
  submissions: "submission:read",
  interviews: "interview:read",
  offers: "offer:read",
  leads: "lead:read",
  opportunities: "opportunity:read",
  vendors: "vendor:read",
  vendor_submissions: "vendor:read",
  placements: "placement:read",
  timesheets: "timesheet:read",
  expense_claims: "expense:read",
  invoices: "billing:read",
  payments: "receivables:read",
  bgv_cases: "bgv:read",
};

type Choice = { value: string; label: string };
const choices = (values: readonly string[], labels: Record<string, string> = {}): Choice[] =>
  values.map((v) => ({ value: v, label: labels[v] ?? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, " ") }));

export type FilterSpec =
  | { key: string; label: string; type: "date" }
  | { key: string; label: string; type: "number"; min?: number; max?: number }
  | { key: string; label: string; type: "select"; options: Choice[]; multi?: boolean }
  | { key: string; label: string; type: "toggle"; on: string };

const STAGES = ["applied", "shortlisted", "submitted", "interviewing", "selected", "offered", "hired", "rejected", "withdrawn"];
const FUNNEL = ["applied", "shortlisted", "submitted", "interviewing", "selected", "offered", "hired"];
const SOURCES = ["manual", "search", "match", "ai_match", "saved_list", "candidate_360", "career_portal", "import", "api"];
const SOURCE_LABELS = { ai_match: "AI match", candidate_360: "Candidate 360", api: "API" };

const RANGE: FilterSpec[] = [
  { key: "from", label: "From", type: "date" },
  { key: "to", label: "To", type: "date" },
];

/** Filter controls shown in each list's toolbar. */
export const FILTER_SPECS: Record<ReportKind, FilterSpec[]> = {
  applications: [
    { key: "stage", label: "Stage", type: "select", options: choices(STAGES), multi: true },
    { key: "reached", label: "Reached stage", type: "select", options: choices(FUNNEL) },
    { key: "source", label: "Source", type: "select", options: choices(SOURCES, SOURCE_LABELS) },
    ...RANGE,
    { key: "owner", label: "Owned by me", type: "toggle", on: "me" },
    { key: "active", label: "Active only", type: "toggle", on: "true" },
  ],
  submissions: [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: choices(["draft", "pending_approval", "approved", "sent", "cancelled", "approval_rejected"]),
      multi: true,
    },
    {
      key: "feedback",
      label: "Client feedback",
      type: "select",
      options: choices(["none", "interested", "rejected_pending", "rejected", "on_hold"], {
        none: "No feedback",
        rejected_pending: "Rejection pending",
      }),
    },
    ...RANGE,
    { key: "older_than", label: "Older than (business days)", type: "number", min: 0, max: 365 },
    { key: "sent_by", label: "Sent by me", type: "toggle", on: "me" },
    { key: "db_sourced", label: "Database-sourced", type: "toggle", on: "true" },
    { key: "has_interview", label: "Has interview", type: "toggle", on: "true" },
  ],
  interviews: [
    { key: "status", label: "Status", type: "select", options: choices(["scheduled", "completed", "cancelled", "no_show"]), multi: true },
    ...RANGE,
    { key: "date", label: "Today", type: "toggle", on: "today" },
    { key: "mine", label: "Mine", type: "toggle", on: "true" },
  ],
  offers: [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: choices(["draft", "pending_approval", "approved", "released", "viewed", "accepted", "declined", "expired", "withdrawn"]),
      multi: true,
    },
    ...RANGE,
    { key: "mine", label: "Mine", type: "toggle", on: "true" },
  ],
  leads: [...RANGE],
  opportunities: [...RANGE],
  vendors: [],
  vendor_submissions: [...RANGE],
  placements: [
    { key: "status", label: "Status", type: "select", options: choices(["pre_joining", "joining_confirmed", "active", "offboarding", "ended", "dropped"]), multi: true },
    ...RANGE,
  ],
  timesheets: [
    { key: "status", label: "Status", type: "select", options: choices(["draft", "submitted", "approved", "rejected"]), multi: true },
    ...RANGE,
  ],
  expense_claims: [...RANGE],
  invoices: [{ key: "status", label: "Status", type: "select", options: choices(["issued", "cancelled"]) }, ...RANGE],
  payments: [...RANGE],
  bgv_cases: [...RANGE],
};

const COMMON_KEYS = ["from", "to", "business_unit_ids", "client_owner"];
const P2_FILTER_KEYS = ["from", "to", "legal_entity_ids", "client_id", "vendor_id", "status", "q"];

/** Every filter the backend accepts per kind (drill-down links may carry ones without a control). */
export const FILTER_KEYS: Record<ReportKind, readonly string[]> = {
  applications: [...COMMON_KEYS, "stage", "reached", "source", "demand_id", "client_id", "owner", "scope", "active", "include_archived"],
  submissions: [...COMMON_KEYS, "sent_by", "status", "feedback", "older_than", "db_sourced", "has_interview", "demand_id", "client_id"],
  interviews: [...COMMON_KEYS, "date", "mine", "status", "demand_id"],
  offers: [...COMMON_KEYS, "status", "mine", "demand_id", "client_id"],
  leads: P2_FILTER_KEYS,
  opportunities: P2_FILTER_KEYS,
  vendors: P2_FILTER_KEYS,
  vendor_submissions: P2_FILTER_KEYS,
  placements: P2_FILTER_KEYS,
  timesheets: P2_FILTER_KEYS,
  expense_claims: P2_FILTER_KEYS,
  invoices: P2_FILTER_KEYS,
  payments: P2_FILTER_KEYS,
  bgv_cases: P2_FILTER_KEYS,
};

/** Filters sent as JSON lists in an export body. */
const LIST_KEYS = new Set(["business_unit_ids", "legal_entity_ids"]);
const BOOL_KEYS = new Set(["active", "include_archived", "db_sourced", "has_interview", "mine"]);
const INT_KEYS = new Set(["older_than"]);

export type ReportParams = {
  filters: Record<string, string[]>;
  sort: string | null;
  page: number;
  fromDashboard: boolean;
};

type ParamSource = { get(name: string): string | null; getAll(name: string): string[] };

const SORT_RE = /^-?[a-z_]{1,40}$/;

/** List state from the page URL: only the kind's known filters are kept. */
export function parseReportParams(kind: ReportKind, params: ParamSource): ReportParams {
  const filters: Record<string, string[]> = {};
  for (const key of FILTER_KEYS[kind]) {
    const values = params
      .getAll(key)
      .map((v) => v.trim().slice(0, 400))
      .filter(Boolean);
    if (values.length) filters[key] = LIST_KEYS.has(key) ? values : [values[0]];
  }
  const sort = params.get("sort");
  const page = Number(params.get("page"));
  return {
    filters,
    sort: sort && SORT_RE.test(sort) ? sort : null,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    fromDashboard: params.get(FROM_DASHBOARD_PARAM) === FROM_DASHBOARD_VALUE,
  };
}

function appendFilters(out: URLSearchParams, filters: Record<string, string[]>) {
  for (const [key, values] of Object.entries(filters)) for (const v of values) if (v !== "") out.append(key, v);
}

/** Page URL query (without `?`). */
export function reportParamsToSearch(p: ReportParams): string {
  const out = new URLSearchParams();
  appendFilters(out, p.filters);
  if (p.sort) out.set("sort", p.sort);
  if (p.page > 1) out.set("page", String(p.page));
  if (p.fromDashboard) out.set(FROM_DASHBOARD_PARAM, FROM_DASHBOARD_VALUE);
  return out.toString();
}

/** Query string for `GET /reports/lists/{kind}`. */
export function reportListQuery(p: ReportParams, pageSize: number): string {
  const out = pageParams(p.page, pageSize);
  appendFilters(out, p.filters);
  if (p.sort) out.set("sort", p.sort);
  return out.toString();
}

/** The list's filters as an export body `filters` object (typed like the backend filter model). */
export function reportExportFilters(p: ReportParams): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, values] of Object.entries(p.filters)) {
    if (!values.length) continue;
    if (LIST_KEYS.has(key)) out[key] = values;
    else if (BOOL_KEYS.has(key)) out[key] = values[0] === "true" || values[0] === "1";
    else if (INT_KEYS.has(key) && Number.isInteger(Number(values[0]))) out[key] = Number(values[0]);
    else out[key] = values[0];
  }
  if (p.sort) out.sort = p.sort;
  return out;
}

export function hasReportFilters(p: ReportParams): boolean {
  return Object.values(p.filters).some((v) => v.length > 0);
}

/** Set (or clear, with null / "") one filter; the page resets to 1. */
export function withFilter(p: ReportParams, key: string, value: string | null): ReportParams {
  const filters = { ...p.filters };
  if (value === null || value === "") delete filters[key];
  else filters[key] = [value];
  return { ...p, filters, page: 1 };
}

/** Drill-down filters without a toolbar control (shown as "also filtered by …"). */
export function hiddenFilterLabels(kind: ReportKind, p: ReportParams): string[] {
  const shown = new Set(FILTER_SPECS[kind].map((s) => s.key));
  const labels: Record<string, string> = {
    business_unit_ids: "business units",
    client_owner: "my clients",
    demand_id: "demand",
    client_id: "client",
    scope: "my pipeline",
    include_archived: "including archived",
    reached: "reached stage",
    owner: "owner",
    sent_by: "sender",
  };
  return Object.keys(p.filters)
    .filter((k) => !shown.has(k) || (k === "sent_by" && p.filters[k][0] !== "me") || (k === "owner" && p.filters[k][0] !== "me"))
    .map((k) => labels[k] ?? k.replace(/_/g, " "));
}

/** Grid sort state from the API `sort` value. */
export function sortState(sort: string | null): { sortColumn: string | undefined; sortDirection: "ascending" | "descending" } {
  if (!sort) return { sortColumn: undefined, sortDirection: "ascending" };
  return sort.startsWith("-")
    ? { sortColumn: sort.slice(1), sortDirection: "descending" }
    : { sortColumn: sort, sortDirection: "ascending" };
}

export function toSort(column: string, direction: "ascending" | "descending"): string {
  return direction === "descending" ? `-${column}` : column;
}

/** Epic 34 (B3): finance lists hide money columns from callers without `report:finance_export`. */
export function financeVisibleColumns<C extends { type: string }>(kind: ReportKind, columns: readonly C[], canFinanceExport: boolean): C[] {
  if (canFinanceExport || !FINANCE_REPORT_KINDS.includes(kind)) return [...columns];
  return columns.filter((c) => c.type !== "money");
}
