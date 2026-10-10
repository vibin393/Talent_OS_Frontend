/** Hand-written types of the Epic 52 (Phase 3 dashboards) API additions. */
import type { P2TileDef, P2TileOut } from "../p2/types";

/** Phase 3 dashboard keys, in the order the API returns them (after the P1/P2 keys, when permitted). */
export const P3_DASHBOARD_KEYS = ["marketing", "referrals", "campus", "mobility", "skills", "projects", "immigration", "predictions"] as const;
export type P3DashboardKey = (typeof P3_DASHBOARD_KEYS)[number];

export function isP3Dashboard(key: string | null | undefined): key is P3DashboardKey {
  return !!key && (P3_DASHBOARD_KEYS as readonly string[]).includes(key);
}

export type P3TileDef = P2TileDef;

/** P3 tiles render through the P2 shell; `badge` is "Supporting signal" on prediction tiles. */
export type P3TileOut = P2TileOut & { badge?: string | null };
