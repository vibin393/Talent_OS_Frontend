/**
 * Placement page panel registry (Phase 3). Phase 3 domains add panels to the Placement Overview tab here
 * instead of editing `placement-detail.tsx`: Predictive Analytics (Epic 48) registers the prediction panel.
 */
import type { ComponentType } from "react";

export type PlacementPanelProps = { placementId: string; placementStatus: string };

export type PlacementPanel = {
  key: string;
  /** Shown only when the user holds this permission (any of them, for an array). */
  permission?: string | readonly string[];
  /** Sort position (lower first). */
  order?: number;
  component: ComponentType<PlacementPanelProps>;
};

const registry = new Map<string, PlacementPanel>();

/** Register (or replace) a Placement panel. Call from a module imported by `placement-detail.tsx`. */
export function registerPlacementPanel(panel: PlacementPanel): void {
  registry.set(panel.key, panel);
}

/** Registered panels the user may see, in `order`. */
export function placementPanels(has: (permission: string) => boolean): PlacementPanel[] {
  return [...registry.values()]
    .filter((p) => {
      if (!p.permission) return true;
      const perms = typeof p.permission === "string" ? [p.permission] : p.permission;
      return perms.some(has);
    })
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}
