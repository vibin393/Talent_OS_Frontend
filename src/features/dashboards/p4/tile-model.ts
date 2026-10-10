/** Pure view models of the Phase 4 dashboards (Epic 65, spec B5): tab gating, "Estimate", link-only SM-C16, USD. */
import { formatUsd } from "@/features/ai-governance/logic";
import { hasPermission, type PermissionMap } from "@/features/auth/permissions";
import { isMoney, type P2TileOut } from "../p2/types";

export const P4_DASHBOARD_KEYS = ["agents", "agent_outcomes"] as const;
export type P4DashboardKey = (typeof P4_DASHBOARD_KEYS)[number];

/** Permission each P4 tab needs ("AI agents" `ai:govern`, "Agent outcomes" `report:read`). */
export const P4_TAB_PERMISSION: Record<P4DashboardKey, string> = { agents: "ai:govern", agent_outcomes: "report:read" };
export const P4_TAB_LABELS: Record<P4DashboardKey, string> = { agents: "AI agents", agent_outcomes: "Agent outcomes" };

export function isP4Dashboard(key: string | null | undefined): key is P4DashboardKey {
  return !!key && (P4_DASHBOARD_KEYS as readonly string[]).includes(key);
}

/** Whether a dashboard tab is shown: P4 tabs only when the API lists them and the viewer holds the permission. */
export function isTabVisible(key: string, permissions: PermissionMap): boolean {
  if (!isP4Dashboard(key)) return true;
  return hasPermission(permissions, P4_TAB_PERMISSION[key]);
}

/** P4 tab keys the API returned and the viewer may open. */
export function p4TabKeys(items: readonly { key: string }[], permissions: PermissionMap): P4DashboardKey[] {
  return items.map((d) => d.key).filter((k): k is P4DashboardKey => isP4Dashboard(k) && isTabVisible(k, permissions));
}

export const ESTIMATE_TILE_KEYS = ["sm30_coordination_time"] as const;
export const ESTIMATE_TOOLTIP = "Estimated from agent activity and typical task times, not measured.";
export const BIAS_AUDIT_TILE = "smc16_impact_ratios";
export const BIAS_AUDIT_LINK_TEXT = "Open bias audit";

export type P4Badge = { key: string; label: string; tooltip: string; color: "informative" | "warning" | "brand" | "subtle" };

/** "Estimate" badge on SM-30 tiles (from the tile's `estimate` flag, or the tile key while loading). */
export function p4Badges(tileKey: string, tile: Pick<P2TileOut, "estimate"> | null): P4Badge[] {
  const estimate = tile?.estimate ?? (ESTIMATE_TILE_KEYS as readonly string[]).includes(tileKey);
  return estimate ? [{ key: "estimate", label: "Estimate", tooltip: ESTIMATE_TOOLTIP, color: "warning" }] : [];
}

/** SM-C16 is a link-only card: never a fairness number on a dashboard. */
export function isLinkOnlyTile(tileKey: string, tile?: Pick<P2TileOut, "value" | "link" | "rows"> | null): boolean {
  if (tileKey === BIAS_AUDIT_TILE) return true;
  return !!tile && tile.value === null && !!tile.link && !(tile.rows && tile.rows.length);
}

/** The link-only card's href (`{path, query}` from the API; `/fairness` by default). */
export function linkOnlyHref(link: { path: string; query?: Record<string, unknown> } | null | undefined): string {
  const path = link?.path && link.path.startsWith("/") && !link.path.startsWith("//") ? link.path : "/fairness";
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(link?.query ?? {})) for (const x of Array.isArray(v) ? v : [v]) q.append(k, String(x));
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
}

const USD_KEYS = /(^|_)(cost|usd|spend)(_|$)/;

/** A cell as USD text when it is USD money or a `*cost*` / `*usd*` decimal string; otherwise unchanged. */
function usdCell(key: string, value: unknown): unknown {
  if (isMoney(value) && value.currency === "USD") return formatUsd(value.amount);
  if (USD_KEYS.test(key) && (typeof value === "string" || typeof value === "number")) return formatUsd(value);
  return value;
}

/**
 * Cost is shown as USD with 2 decimals: USD money objects and cost columns in rows become text, and a USD headline
 * is returned separately (the P2 shell formats money with Indian grouping).
 */
export function usdTile(tile: P2TileOut): { tile: P2TileOut; headline: string | null } {
  const rows = tile.rows?.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, usdCell(k, v)])));
  const usd = tile.money && tile.money.currency === "USD" ? formatUsd(tile.money.amount) : null;
  return { tile: { ...tile, rows: rows ?? tile.rows, money: usd ? null : tile.money, estimate: false }, headline: usd };
}

/** The `agent_key` filter as an extra tile query. */
export function agentQuery(agentKey: string | null | undefined): string {
  return agentKey ? `agent_key=${encodeURIComponent(agentKey)}` : "";
}
