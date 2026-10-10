/** Drill-down links of dashboard tiles (`{path, query}` from the API) as app hrefs. */
import type { TileLink } from "@/lib/api/types";

/** Marker added to report-list links so the list shows "Filtered from dashboard". */
export const FROM_DASHBOARD_PARAM = "src";
export const FROM_DASHBOARD_VALUE = "dashboard";

/** App routes a tile may link to; anything else (a page that does not exist yet) is not linked. */
const KNOWN_PREFIXES = [
  "/demands", "/candidates", "/clients", "/reports/", "/tasks", "/admin/users", "/exports",
  // Epic 34: Phase 2 owning-epic list routes.
  "/billing", "/receivables", "/placements", "/timesheets", "/bgv", "/bench", "/vendors", "/onboarding",
  "/compliance", "/purchase-orders", "/payroll", "/workers",
];

export function isKnownRoute(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  return KNOWN_PREFIXES.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`) || path.startsWith(`${p}?`));
}

/** Query string of a link (list values become repeated parameters), in a stable order. */
export function linkSearch(query: TileLink["query"] | undefined, extra?: Record<string, string>): string {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    for (const v of Array.isArray(value) ? value : [value]) out.append(key, String(v));
  }
  for (const [key, value] of Object.entries(extra ?? {})) out.set(key, value);
  return out.toString();
}

/** The app href of a tile link, or null when it points at a route the app does not have. */
export function tileHref(link: TileLink | null | undefined): string | null {
  if (!link || !isKnownRoute(link.path)) return null;
  const extra = link.path.startsWith("/reports/") ? { [FROM_DASHBOARD_PARAM]: FROM_DASHBOARD_VALUE } : undefined;
  const qs = linkSearch(link.query, extra);
  return qs ? `${link.path}?${qs}` : link.path;
}

/** The href of row `index` (falling back to the tile's own link). */
export function rowHref(
  rowLinks: readonly (TileLink | null)[] | null | undefined,
  index: number,
  fallback?: TileLink | null,
): string | null {
  return tileHref(rowLinks?.[index] ?? null) ?? tileHref(fallback);
}

/** A copy of `link` narrowed to one bucket (`from`/`to`) of a series. */
export function bucketLink(link: TileLink, from: string, to: string): TileLink {
  return { path: link.path, query: { ...link.query, from, to } };
}
