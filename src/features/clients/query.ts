/** Pure mapping from the clients list UI state (filters, sort, paging) to the API query string. */
import { type ExtensionTabKey, isExtensionTabKey } from "./client-360-tabs";
import { pageParams } from "@/features/admin/query";
import type { ClientStatus } from "@/lib/api/types";

export const CLIENT_SORT_FIELDS = ["name", "status", "created_at", "updated_at"] as const;
export type ClientSortField = (typeof CLIENT_SORT_FIELDS)[number];
export type ClientSort = { field: ClientSortField; direction: "ascending" | "descending" };

export type ClientListFilters = {
  q: string;
  status: ClientStatus | null;
  ownerId: string | null;
  includeArchived: boolean;
};

export const EMPTY_CLIENT_FILTERS: ClientListFilters = { q: "", status: null, ownerId: null, includeArchived: false };
export const DEFAULT_CLIENT_SORT: ClientSort = { field: "name", direction: "ascending" };

/** `sort` parameter: the field, prefixed with `-` for descending. */
export function sortParam(sort: ClientSort): string {
  return `${sort.direction === "descending" ? "-" : ""}${sort.field}`;
}

export function isClientSortField(v: unknown): v is ClientSortField {
  return typeof v === "string" && (CLIENT_SORT_FIELDS as readonly string[]).includes(v);
}

/** Query string (without `?`) for `GET /api/v1/clients`. Empty filters are omitted. */
export function clientListQuery(
  filters: ClientListFilters,
  sort: ClientSort,
  page: number,
  pageSize: number,
): string {
  const params = pageParams(page, pageSize);
  const q = filters.q.trim().slice(0, 200);
  if (q) params.set("q", q);
  if (filters.status) params.set("status", filters.status);
  if (filters.ownerId) params.set("owner_id", filters.ownerId);
  if (filters.includeArchived) params.set("include_archived", "true");
  params.set("sort", sortParam(sort));
  return params.toString();
}

export function hasClientFilters(filters: ClientListFilters): boolean {
  return filters.q.trim() !== "" || filters.status !== null || filters.ownerId !== null || filters.includeArchived;
}

export type ClientTab = "overview" | "contacts" | "activity" | ExtensionTabKey;
export const CLIENT_TABS: readonly ClientTab[] = ["overview", "contacts", "activity"];

/** The Client 360 tab named by a `?tab=` search parameter (Overview when missing or unknown). Phase 2 tabs
 * (`client-360-tabs.ts`) are accepted by their reserved key. */
export function parseClientTab(value: unknown): ClientTab {
  if (isExtensionTabKey(value)) return value;
  return CLIENT_TABS.find((t) => t === value) ?? "overview";
}
