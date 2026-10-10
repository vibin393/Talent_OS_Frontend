/**
 * Offer drawer panel registry (Phase 3). Phase 3 domains add panels to the Offer drawer here instead of
 * editing `offer-drawer.tsx`: Predictive Analytics (Epic 48) registers the offer-drop risk panel.
 * Registered panels render under the offer summary, above the tabs.
 */
import type { ComponentType } from "react";

export type OfferPanelProps = { offerId: string; offerStatus: string };

export type OfferPanel = {
  key: string;
  /** Shown only when the user holds this permission (any of them, for an array). */
  permission?: string | readonly string[];
  /** Sort position (lower first). */
  order?: number;
  component: ComponentType<OfferPanelProps>;
};

const registry = new Map<string, OfferPanel>();

/** Register (or replace) an Offer panel. Call from a module imported by `offer-drawer.tsx`. */
export function registerOfferPanel(panel: OfferPanel): void {
  registry.set(panel.key, panel);
}

/** Registered panels the user may see, in `order`. */
export function offerPanels(has: (permission: string) => boolean): OfferPanel[] {
  return [...registry.values()]
    .filter((p) => {
      if (!p.permission) return true;
      const perms = typeof p.permission === "string" ? [p.permission] : p.permission;
      return perms.some(has);
    })
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}
