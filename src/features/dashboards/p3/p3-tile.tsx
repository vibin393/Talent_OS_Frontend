"use client";

import type { TileState } from "../tile-card";
import { P2TileCard } from "../p2/p2-tile";
import { maskTile, p3Badges } from "./tile-model";
import type { P3TileDef, P3TileOut } from "./types";

/** Phase 3 tile card: the P2 shell (money formatting, "View as table") plus signal / masked badges. */
export function P3TileCard({
  dashboardKey,
  def,
  state,
  onRetry,
  span = 1,
}: {
  dashboardKey: string;
  def: P3TileDef;
  state: TileState;
  onRetry?: () => void;
  span?: number;
}) {
  const tile = state.status === "ok" ? maskTile(state.tile as unknown as P3TileOut) : null;
  const shown: TileState = tile && state.status === "ok" ? { ...state, tile: tile as unknown as typeof state.tile } : state;
  return <P2TileCard def={def} state={shown} onRetry={onRetry} span={span} extraBadges={p3Badges(tile, dashboardKey)} />;
}
