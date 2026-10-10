/**
 * Application drawer panel registry (Phase 4). Phase 4 domains add panels to the Application drawer here instead of
 * editing `application-drawer.tsx` (same pattern as `offers/offer-panels.ts`): the Screening Agent (Epic 57)
 * registers `agent_screening`. Registered panels render in the Screening tab, above the P1 screening panels.
 */
import type { ComponentType } from "react";

export type ApplicationPanelProps = { applicationId: string; stageKey: string; demandId: string };

export type ApplicationPanel = {
  key: string;
  /** Shown only when the user holds this permission (any of them, for an array). */
  permission?: string | readonly string[];
  /** Sort position (lower first). */
  order?: number;
  /** Drawer tab the panel renders in (Epic 61, additive; default the Screening tab). */
  tab?: "screening" | "submissions";
  component: ComponentType<ApplicationPanelProps>;
};

const registry = new Map<string, ApplicationPanel>();

/** Register (or replace) an Application panel. Call from a module imported by `application-drawer.tsx`. */
export function registerApplicationPanel(panel: ApplicationPanel): void {
  registry.set(panel.key, panel);
}

/** Registered panels the user may see, in `order` (of one drawer tab; default the Screening tab). */
export function applicationPanels(
  has: (permission: string) => boolean,
  tab: "screening" | "submissions" = "screening",
): ApplicationPanel[] {
  return [...registry.values()]
    .filter((p) => (p.tab ?? "screening") === tab)
    .filter((p) => {
      if (!p.permission) return true;
      const perms = typeof p.permission === "string" ? [p.permission] : p.permission;
      return perms.some(has);
    })
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}
