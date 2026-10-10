/** Hand-written types of the Epic 34 (Phase 2 dashboards) API additions. */
import type { TileDefOut, TileLink, TileOut } from "@/lib/api/types";

export type Money = { amount: string; currency: string };

export const P2_DASHBOARD_KEYS = ["finance", "account_ops", "onboarding", "compliance", "delivery", "executive"] as const;
export type P2DashboardKey = (typeof P2_DASHBOARD_KEYS)[number];

export function isP2Dashboard(key: string | null | undefined): key is P2DashboardKey {
  return !!key && (P2_DASHBOARD_KEYS as readonly string[]).includes(key);
}

export type P2TileDef = TileDefOut & { compensation?: boolean; estimate?: boolean };

export type P2SeriesPoint = { bucket: string; value: string | number | null };
export type P2Series = { key: string; label: string; points: P2SeriesPoint[]; masked?: boolean };

export type P2TileOut = Omit<TileOut, "series" | "rows"> & {
  rows?: Record<string, unknown>[] | null;
  series?: P2Series[] | null;
  money?: Money | null;
  estimate?: boolean | null;
  source?: "summary" | "live" | null;
  masked?: boolean | null;
  as_of?: string | null;
  series_keys?: { key: string; label: string }[] | null;
  link?: TileLink | null;
};

export type ExecCell = { month: string; value: Money | string | number | null; source: "summary" | "live" };
export type ExecRow = { key: string; label: string; kind: "money" | "percent" | "count" | "number"; masked: boolean; cells: ExecCell[] };
export type ExecGridOut = { legal_entity_id: string; months: string[]; rows: ExecRow[]; computed_at: string };

export type LegalEntityOption = { id: string; name: string; status?: string };

export function isMoney(value: unknown): value is Money {
  return !!value && typeof value === "object" && typeof (value as Money).amount === "string" && typeof (value as Money).currency === "string";
}
