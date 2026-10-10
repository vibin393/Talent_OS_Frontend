/** Pure mapping from admin list UI state (filters + paging) to API query strings. */

export const DEFAULT_PAGE_SIZE = 20;
/** Backend maximum page size (`MAX_PAGE_SIZE`); used for picker lookups. */
export const MAX_PAGE_SIZE = 100;

export type UserStatusFilter = "all" | "active" | "inactive";

export type UserListFilters = {
  q: string;
  status: UserStatusFilter;
  roleId: string | null;
  teamId: string | null;
  businessUnitId: string | null;
};

export const EMPTY_USER_FILTERS: UserListFilters = {
  q: "",
  status: "all",
  roleId: null,
  teamId: null,
  businessUnitId: null,
};

function clampPage(page: number): number {
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

function clampPageSize(size: number): number {
  if (!Number.isFinite(size) || size < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(size), MAX_PAGE_SIZE);
}

/** `page`/`page_size` query parameters. */
export function pageParams(page: number, pageSize: number = DEFAULT_PAGE_SIZE): URLSearchParams {
  return new URLSearchParams({ page: String(clampPage(page)), page_size: String(clampPageSize(pageSize)) });
}

/** Query string (without `?`) for `GET /api/v1/admin/users`. Empty filters are omitted. */
export function userListQuery(filters: UserListFilters, page: number, pageSize: number = DEFAULT_PAGE_SIZE): string {
  const params = pageParams(page, pageSize);
  const q = filters.q.trim().slice(0, 200);
  if (q) params.set("q", q);
  if (filters.status === "active") params.set("is_active", "true");
  else if (filters.status === "inactive") params.set("is_active", "false");
  if (filters.roleId) params.set("role_id", filters.roleId);
  if (filters.teamId) params.set("team_id", filters.teamId);
  if (filters.businessUnitId) params.set("business_unit_id", filters.businessUnitId);
  return params.toString();
}

export function hasActiveFilters(filters: UserListFilters): boolean {
  return (
    filters.q.trim() !== "" ||
    filters.status !== "all" ||
    filters.roleId !== null ||
    filters.teamId !== null ||
    filters.businessUnitId !== null
  );
}

/** "1-20 of 45" style range for a page; `pageCount` is at least 1. */
export function pageRange(
  page: number,
  pageSize: number,
  total: number,
): { from: number; to: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  if (total <= 0) return { from: 0, to: 0, pageCount };
  const from = (page - 1) * pageSize + 1;
  return { from: Math.min(from, total), to: Math.min(page * pageSize, total), pageCount };
}
