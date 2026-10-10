/** Pure view models of Phase 3 tiles: dashboard tab gating, extra badges and masked-money notes. */
import { isMoney } from "../p2/types";
import { isP3Dashboard, type P3TileOut } from "./types";

export const SUPPORTING_SIGNAL = "Supporting signal";
export const SUPPORTING_SIGNAL_TOOLTIP = "A model estimate to support human judgement, not a decision.";
export const MASKED_TOOLTIP = "Amounts are hidden. Ask an admin for compensation access to see them.";

export type P3Badge = { key: string; label: string; tooltip: string; color: "informative" | "warning" | "brand" | "subtle" };

/** Keys of the Phase 3 dashboards the API returned (tabs appear only when the server lists them). */
export function p3TabKeys(items: readonly { key: string }[]): string[] {
  return items.map((d) => d.key).filter((k) => isP3Dashboard(k));
}

/** Whether a dashboard tab carries the "Supporting signal" badge (the predictions dashboard). */
export function tabHasSupportingSignal(key: string | null | undefined): boolean {
  return key === "predictions";
}

/**
 * Extra badges of a P3 tile: the server's `badge` (e.g. "Supporting signal" on prediction tiles; also assumed
 * while a prediction tile is loading) and "Amounts hidden" when money was masked for this viewer.
 */
export function p3Badges(tile: Pick<P3TileOut, "badge" | "masked"> | null, dashboardKey?: string | null): P3Badge[] {
  const out: P3Badge[] = [];
  const label = tile?.badge ?? (!tile && dashboardKey === "predictions" ? SUPPORTING_SIGNAL : null);
  if (label) {
    out.push({
      key: "signal",
      label,
      tooltip: label === SUPPORTING_SIGNAL ? SUPPORTING_SIGNAL_TOOLTIP : label,
      color: "brand",
    });
  }
  if (tile?.masked) out.push({ key: "masked", label: "Amounts hidden", tooltip: MASKED_TOOLTIP, color: "subtle" });
  return out;
}

/** Defensive masking: a masked tile never shows money even if a money field slips through. */
export function maskTile(tile: P3TileOut): P3TileOut {
  if (!tile.masked) return tile;
  const strip = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).filter(([, v]) => !isMoney(v)));
  return { ...tile, money: null, rows: tile.rows ? tile.rows.map(strip) : tile.rows };
}
