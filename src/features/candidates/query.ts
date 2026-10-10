/** Pure mapping from the candidate list UI state (filters, sort, paging) to API query strings. */
import type { CandidateSource } from "@/lib/api/types";
import { DEFAULT_PAGE_SIZE, pageParams } from "@/features/admin/query";

export type CandidateSort = "name" | "-name" | "created_at" | "-created_at" | "updated_at" | "-updated_at";

export type CandidateListFilters = {
  q: string;
  ownerId: string | null;
  tagId: string | null;
  listId: string | null;
  source: CandidateSource | null;
  includeArchived: boolean;
  sort: CandidateSort;
};

export const EMPTY_CANDIDATE_FILTERS: CandidateListFilters = {
  q: "",
  ownerId: null,
  tagId: null,
  listId: null,
  source: null,
  includeArchived: false,
  sort: "-updated_at",
};

/** Query string (without `?`) for `GET /api/v1/candidates`. Defaults are omitted. */
export function candidateListQuery(
  filters: CandidateListFilters,
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): string {
  const params = pageParams(page, pageSize);
  const q = filters.q.trim().slice(0, 200);
  if (q) params.set("q", q);
  if (filters.ownerId) params.set("owner_id", filters.ownerId);
  if (filters.tagId) params.set("tag_id", filters.tagId);
  if (filters.listId) params.set("list_id", filters.listId);
  if (filters.source) params.set("source", filters.source);
  if (filters.includeArchived) params.set("include_archived", "true");
  params.set("sort", filters.sort);
  return params.toString();
}

export function hasActiveCandidateFilters(filters: CandidateListFilters): boolean {
  return (
    filters.q.trim() !== "" ||
    filters.ownerId !== null ||
    filters.tagId !== null ||
    filters.listId !== null ||
    filters.source !== null ||
    filters.includeArchived
  );
}

/** Grid columns that the API can sort by, mapped to its sort keys. */
const SORT_KEYS: Record<string, "name" | "created_at" | "updated_at"> = {
  name: "name",
  updated: "updated_at",
  created: "created_at",
};

export function isSortableColumn(columnId: string): boolean {
  return columnId in SORT_KEYS;
}

/** Grid sort state (column + direction) -> API `sort` value; unknown columns keep the current sort. */
export function toApiSort(columnId: string, direction: "ascending" | "descending", current: CandidateSort): CandidateSort {
  const key = SORT_KEYS[columnId];
  if (!key) return current;
  return (direction === "descending" ? `-${key}` : key) as CandidateSort;
}

/** API `sort` value -> grid sort state. */
export function fromApiSort(sort: CandidateSort): { sortColumn: string; sortDirection: "ascending" | "descending" } {
  const desc = sort.startsWith("-");
  const key = desc ? sort.slice(1) : sort;
  const column = Object.entries(SORT_KEYS).find(([, v]) => v === key)?.[0] ?? "updated";
  return { sortColumn: column, sortDirection: desc ? "descending" : "ascending" };
}

/** Candidate list filters as an export body `filters` object (the backend `CandidateFilters` names). */
export function candidateExportFilters(filters: CandidateListFilters): Record<string, unknown> {
  const out: Record<string, unknown> = { sort: filters.sort };
  const q = filters.q.trim().slice(0, 200);
  if (q) out.q = q;
  if (filters.ownerId) out.owner_id = filters.ownerId;
  if (filters.tagId) out.tag_id = filters.tagId;
  if (filters.listId) out.list_id = filters.listId;
  if (filters.source) out.source = filters.source;
  if (filters.includeArchived) out.include_archived = true;
  return out;
}
