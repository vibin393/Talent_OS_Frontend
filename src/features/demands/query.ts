/** Pure mapping between the demand list UI state, the page URL (`?status=open&...`) and the API query. */
import { pageParams } from "@/features/admin/query";
import type { DemandPriority, DemandStatus, SlaStatus } from "@/lib/api/types";
import { DEMAND_STATUSES, PRIORITIES } from "./status";
import { DEMAND_EXTENSION_TAB_KEYS, type DemandExtensionTabKey } from "./demand-tabs";

export const DEMAND_SORTS = [
  "-created_at",
  "created_at",
  "target_closure_date",
  "-target_closure_date",
  "-priority",
  "priority",
] as const;
export type DemandSort = (typeof DEMAND_SORTS)[number];

const SLA_STATUSES: readonly SlaStatus[] = ["healthy", "at_risk", "breached", "met"];

export type DemandListFilters = {
  q: string;
  status: DemandStatus[];
  priority: DemandPriority[];
  clientId: string | null;
  /** `me`, a user id, or null (anyone). */
  assignedTo: string | null;
  slaStatus: SlaStatus | null;
  sort: DemandSort;
  page: number;
  // Dashboard drill-down filters (Epic 11): no toolbar control, kept in the URL and sent to the API.
  openedFrom?: string | null;
  openedTo?: string | null;
  businessUnitIds?: string[];
  clientOwner?: "me" | null;
};

export const EMPTY_DEMAND_FILTERS: DemandListFilters = {
  q: "",
  status: [],
  priority: [],
  clientId: null,
  assignedTo: null,
  slaStatus: null,
  sort: "-created_at",
  page: 1,
  // Explicitly undefined so "Clear filters" (`{...filters, ...EMPTY}`) drops drill-down filters too.
  openedFrom: undefined,
  openedTo: undefined,
  businessUnitIds: undefined,
  clientOwner: undefined,
};

type ParamSource = { get(name: string): string | null; getAll(name: string): string[] };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pick<T extends string>(values: string[], allowed: readonly T[]): T[] {
  return [...new Set(values.flatMap((v) => v.split(",")))].filter((v): v is T => (allowed as readonly string[]).includes(v));
}

/** Filters from the page URL; unknown or malformed values are dropped. */
export function parseDemandFilters(params: ParamSource): DemandListFilters {
  // `assignee` / `sla` are the dashboard drill-down aliases of `assigned_to` / `sla_status`.
  const assigned = params.get("assigned_to") ?? params.get("assignee");
  const client = params.get("client_id");
  const sort = params.get("sort");
  const sla = params.get("sla_status") ?? params.get("sla");
  const page = Number(params.get("page"));
  const date = (name: string) => {
    const v = params.get(name);
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  };
  const drill: Partial<DemandListFilters> = {};
  if (date("opened_from")) drill.openedFrom = date("opened_from");
  if (date("opened_to")) drill.openedTo = date("opened_to");
  const bus = params.getAll("business_unit_ids").filter((v) => UUID_RE.test(v));
  if (bus.length) drill.businessUnitIds = bus;
  if (params.get("client_owner") === "me") drill.clientOwner = "me";
  return {
    ...drill,
    q: (params.get("q") ?? "").slice(0, 200),
    status: pick(params.getAll("status"), DEMAND_STATUSES),
    priority: pick(params.getAll("priority"), PRIORITIES),
    clientId: client && UUID_RE.test(client) ? client : null,
    assignedTo: assigned === "me" || (assigned && UUID_RE.test(assigned)) ? assigned : null,
    slaStatus: SLA_STATUSES.find((s) => s === sla) ?? null,
    sort: DEMAND_SORTS.find((s) => s === sort) ?? "-created_at",
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** Page URL query string (without `?`) for `filters`; defaults are omitted. */
export function demandFiltersToSearch(filters: DemandListFilters): string {
  const p = new URLSearchParams();
  const q = filters.q.trim();
  if (q) p.set("q", q);
  for (const s of filters.status) p.append("status", s);
  for (const s of filters.priority) p.append("priority", s);
  if (filters.clientId) p.set("client_id", filters.clientId);
  if (filters.assignedTo) p.set("assigned_to", filters.assignedTo);
  if (filters.slaStatus) p.set("sla_status", filters.slaStatus);
  if (filters.sort !== "-created_at") p.set("sort", filters.sort);
  if (filters.page > 1) p.set("page", String(filters.page));
  appendDrillDown(p, filters);
  return p.toString();
}

function appendDrillDown(p: URLSearchParams, filters: DemandListFilters) {
  if (filters.openedFrom) p.set("opened_from", filters.openedFrom);
  if (filters.openedTo) p.set("opened_to", filters.openedTo);
  for (const bu of filters.businessUnitIds ?? []) p.append("business_unit_ids", bu);
  if (filters.clientOwner) p.set("client_owner", filters.clientOwner);
}

/** Demand list filters as an export body `filters` object (the backend `DemandFilters` names). */
export function demandExportFilters(filters: DemandListFilters): Record<string, unknown> {
  const out: Record<string, unknown> = { sort: filters.sort };
  const q = filters.q.trim().slice(0, 200);
  if (q) out.q = q;
  if (filters.status.length) out.status = filters.status;
  if (filters.priority.length) out.priority = filters.priority;
  if (filters.clientId) out.client_id = filters.clientId;
  if (filters.assignedTo) out.assigned_to = filters.assignedTo;
  if (filters.slaStatus) out.sla_status = filters.slaStatus;
  if (filters.openedFrom) out.opened_from = filters.openedFrom;
  if (filters.openedTo) out.opened_to = filters.openedTo;
  if (filters.businessUnitIds?.length) out.business_unit_ids = filters.businessUnitIds;
  if (filters.clientOwner) out.client_owner = filters.clientOwner;
  return out;
}

/** Query string for `GET /api/v1/demands`. */
export function demandListQuery(filters: DemandListFilters, pageSize: number): string {
  const p = pageParams(filters.page, pageSize);
  const q = filters.q.trim().slice(0, 200);
  if (q) p.set("q", q);
  for (const s of filters.status) p.append("status", s);
  for (const s of filters.priority) p.append("priority", s);
  if (filters.clientId) p.set("client_id", filters.clientId);
  if (filters.assignedTo) p.set("assigned_to", filters.assignedTo);
  if (filters.slaStatus) p.set("sla_status", filters.slaStatus);
  p.set("sort", filters.sort);
  appendDrillDown(p, filters);
  return p.toString();
}

export function hasDemandFilters(f: DemandListFilters): boolean {
  return (
    !!f.q.trim() ||
    f.status.length > 0 ||
    f.priority.length > 0 ||
    !!f.clientId ||
    !!f.assignedTo ||
    !!f.slaStatus ||
    !!f.openedFrom ||
    !!f.openedTo ||
    !!f.businessUnitIds?.length ||
    !!f.clientOwner
  );
}

export type DemandTab =
  | "overview"
  | "jd"
  | "pipeline"
  | "interviews"
  | "offers"
  | "matches"
  | "activity"
  | "vendors"
  // Registered extension tabs (`demand-tabs.ts`).
  | DemandExtensionTabKey;
export const DEMAND_TABS: readonly DemandTab[] = [
  "overview",
  "jd",
  "pipeline",
  "interviews",
  "offers",
  "matches",
  "activity",
  "vendors",
  ...DEMAND_EXTENSION_TAB_KEYS,
];

export function parseDemandTab(value: unknown): DemandTab {
  return DEMAND_TABS.find((t) => t === value) ?? "overview";
}
