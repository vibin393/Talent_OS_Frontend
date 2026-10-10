"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { DashboardListOut, TileDefOut, TileOut } from "@/lib/api/types";
import { type DateRange, tileQuery } from "./date-range";

const enc = encodeURIComponent;

export const dashboardsApi = {
  list: (signal?: AbortSignal) => api.get<DashboardListOut>("/api/v1/dashboards", { signal }),
  tile: (dashboard: string, tile: string, query: string, signal?: AbortSignal) =>
    api.get<TileOut>(`/api/v1/dashboards/${enc(dashboard)}/tiles/${enc(tile)}?${query}`, { signal }),
};

export const dashboardKeys = {
  all: ["reporting", "dashboards"] as const,
  list: ["reporting", "dashboards", "list"] as const,
  tile: (dashboard: string, tile: string, range: DateRange, bus: readonly string[], nonce: number, extra = "") =>
    ["reporting", "dashboards", "tile", dashboard, tile, range.from, range.to, [...bus].sort().join(","), nonce, extra] as const,
};

/** The dashboards the caller may open (default first). */
export function useDashboards() {
  const canReport = usePermission("report:read");
  const canGovern = usePermission("ai:govern"); // Epic 65: the "AI agents" dashboard
  const canRead = canReport || canGovern;
  return useQuery({
    queryKey: dashboardKeys.list,
    queryFn: ({ signal }) => dashboardsApi.list(signal),
    enabled: canRead,
    staleTime: 5 * 60_000,
  });
}

/** `extraQuery` (Epic 34): Phase 2 filters (`legal_entity_ids`, `as_of`) appended to the tile query. */
export type TileFilters = { range: DateRange; businessUnitIds: readonly string[]; nonce: number; extraQuery?: string };

function withExtra(query: string, extra?: string): string {
  return extra ? `${query}&${extra}` : query;
}

function tileOptions(dashboard: string, tile: Pick<TileDefOut, "key">, f: TileFilters) {
  return {
    queryKey: dashboardKeys.tile(dashboard, tile.key, f.range, f.businessUnitIds, f.nonce, f.extraQuery ?? ""),
    // `nonce > 0` means the user pressed Refresh: bypass the server-side cache once.
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      dashboardsApi.tile(dashboard, tile.key, withExtra(tileQuery(f.range, f.businessUnitIds, f.nonce > 0), f.extraQuery), signal),
    staleTime: 60_000,
    placeholderData: (prev: TileOut | undefined) => prev,
    retry: (count: number, error: unknown) =>
      count < 1 && (!isApiError(error) || error.status === 0 || error.status >= 500),
  };
}

/** One tile, fetched independently of the others. */
export function useDashboardTile(dashboard: string, tile: Pick<TileDefOut, "key">, filters: TileFilters, enabled = true) {
  return useQuery({ ...tileOptions(dashboard, tile, filters), enabled });
}

/** Every available tile of a dashboard, in parallel (each settles on its own). */
export function useDashboardTiles(dashboard: string | undefined, tiles: readonly TileDefOut[], filters: TileFilters) {
  return useQueries({
    queries: tiles.map((t) => ({ ...tileOptions(dashboard ?? "", t, filters), enabled: !!dashboard && t.available !== false })),
  });
}
