/**
 * Pure helpers for the audit log screen (story 1.6 API): filter -> query mapping and the
 * formatting of `changes` (`{field: {old, new}}`) and `data` payloads for display.
 */
import { DEFAULT_PAGE_SIZE, pageParams } from "./query";

export type AuditFilters = {
  entityType: string;
  entityId: string;
  actorId: string | null;
  /** Action prefix, e.g. `user.` or `auth.login`. */
  action: string;
  /** Inclusive start day, `YYYY-MM-DD` (local time), or "". */
  fromDate: string;
  /** Inclusive end day, `YYYY-MM-DD` (local time), or "". */
  toDate: string;
  /** Epic 35: actor type (`user`, `system`, `client_user`, ...), or "" / undefined for any. */
  actorType?: string;
};

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  entityType: "",
  entityId: "",
  actorId: null,
  action: "",
  fromDate: "",
  toDate: "",
};

/** Epic 35: actor types offered by the audit log's actor-type filter. */
export const AUDIT_ACTOR_TYPES = [
  { value: "user", label: "User" },
  { value: "system", label: "System" },
  { value: "ai", label: "AI" },
  { value: "workflow", label: "Workflow" },
  { value: "client_user", label: "Client user" },
  { value: "vendor_user", label: "Vendor user" },
  { value: "candidate", label: "Candidate" },
  { value: "api_key", label: "API key" },
  { value: "support", label: "Support" },
] as const;

/** Entity types written by the audit listener and explicit events (offered in the filter). */
export const AUDIT_ENTITY_TYPES = [
  "user",
  "invitation",
  "role",
  "user_role",
  "team",
  "team_member",
  "business_unit",
  "tenant",
  "candidate",
  "candidate_list",
  "attachment",
  "tag",
] as const;

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local midnight of a `YYYY-MM-DD` day (plus `addDays`) as an ISO timestamp; null when invalid. */
export function dayStartIso(day: string, addDays = 0): string | null {
  const m = DAY.exec(day.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + addDays);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function auditFilterParams(filters: AuditFilters, params: URLSearchParams): URLSearchParams {
  const entityType = filters.entityType.trim();
  const entityId = filters.entityId.trim();
  const action = filters.action.trim();
  if (entityType) params.set("entity_type", entityType);
  if (entityId) params.set("entity_id", entityId);
  if (filters.actorId) params.set("actor_id", filters.actorId);
  if (action) params.set("action", action);
  if (filters.actorType) params.set("actor_type", filters.actorType);
  // `from` is inclusive and `to` exclusive on the API: the end day is included by sending the next midnight.
  const from = filters.fromDate ? dayStartIso(filters.fromDate) : null;
  const to = filters.toDate ? dayStartIso(filters.toDate, 1) : null;
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return params;
}

/** Query string (without `?`) for `GET /api/v1/admin/audit-logs`. Empty filters are omitted. */
export function auditListQuery(filters: AuditFilters, page: number, pageSize: number = DEFAULT_PAGE_SIZE): string {
  return auditFilterParams(filters, pageParams(page, pageSize)).toString();
}

/** Same-origin URL of the CSV export for the current filters (no paging). */
export function auditExportUrl(filters: AuditFilters): string {
  const qs = auditFilterParams(filters, new URLSearchParams()).toString();
  return `/api/v1/admin/audit-logs/export.csv${qs ? `?${qs}` : ""}`;
}

export function hasActiveAuditFilters(filters: AuditFilters): boolean {
  return (
    filters.entityType.trim() !== "" ||
    filters.entityId.trim() !== "" ||
    filters.actorId !== null ||
    filters.action.trim() !== "" ||
    filters.fromDate !== "" ||
    filters.toDate !== "" ||
    !!filters.actorType
  );
}

/** True when the end day is before the start day. */
export function invalidAuditRange(filters: AuditFilters): boolean {
  return !!filters.fromDate && !!filters.toDate && filters.toDate < filters.fromDate;
}

/** "business_unit_id" -> "Business unit id". */
export function humanizeField(field: string): string {
  const words = field.replace(/[_.]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : field;
}

/** "user.updated" -> "User updated"; "auth.login_failed" -> "Auth login failed". */
export function formatAuditAction(action: string): string {
  return humanizeField(action);
}

export const EMPTY_VALUE = "—";

/** Display text for one audited value (null -> "—", booleans -> Yes/No, lists joined, objects as JSON). */
export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return EMPTY_VALUE;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return EMPTY_VALUE;
    return value.every((v) => v === null || ["string", "number", "boolean"].includes(typeof v))
      ? value.map((v) => formatAuditValue(v)).join(", ")
      : JSON.stringify(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export type AuditChangeRow = {
  field: string;
  label: string;
  old: string;
  new: string;
  kind: "added" | "removed" | "changed";
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Rows "field: old -> new" for an audit entry's `changes`, sorted by field name.
 * Each value is normally `{old, new}` (inserts have `old: null`, deletes `new: null`); a bare value is
 * treated as the new value.
 */
export function auditChangeRows(changes: Record<string, unknown> | null | undefined): AuditChangeRow[] {
  if (!isRecord(changes)) return [];
  return Object.keys(changes)
    .sort((a, b) => a.localeCompare(b))
    .map((field) => {
      const raw = changes[field];
      const pair = isRecord(raw) && ("old" in raw || "new" in raw) ? raw : { old: null, new: raw };
      const oldText = formatAuditValue(pair.old);
      const newText = formatAuditValue(pair.new);
      const kind: AuditChangeRow["kind"] =
        oldText === EMPTY_VALUE && newText !== EMPTY_VALUE
          ? "added"
          : newText === EMPTY_VALUE && oldText !== EMPTY_VALUE
            ? "removed"
            : "changed";
      return { field, label: humanizeField(field), old: oldText, new: newText, kind };
    });
}

/** `data` payload of an explicit event as label/value pairs, sorted by key. */
export function auditDataRows(data: Record<string, unknown> | null | undefined): { key: string; label: string; value: string }[] {
  if (!isRecord(data)) return [];
  return Object.keys(data)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({ key, label: humanizeField(key), value: formatAuditValue(data[key]) }));
}

/** One-line summary for the grid: "3 fields changed: Name, Email, Is active" (first few names). */
export function auditChangeSummary(changes: Record<string, unknown> | null | undefined, max = 3): string {
  const rows = auditChangeRows(changes);
  if (rows.length === 0) return "";
  const names = rows.slice(0, max).map((r) => r.label);
  const more = rows.length > max ? ` +${rows.length - max} more` : "";
  return `${rows.length} field${rows.length === 1 ? "" : "s"}: ${names.join(", ")}${more}`;
}

/** Short form of a UUID for dense grids ("3f2a9c1e…"). */
export function shortId(id: string | null | undefined): string {
  if (!id) return EMPTY_VALUE;
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}
