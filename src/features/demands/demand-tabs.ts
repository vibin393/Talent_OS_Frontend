/**
 * Demand page tab registry (Phase 3, modelled on `clients/client-360-tabs.ts`). Phase 3 domains add their
 * Demand tabs here instead of editing `demand-detail.tsx`: Talent Pools (Epic 38) registers "Pools".
 *
 * The keys are reserved up front (data only) so the server page can parse `?tab=` without loading the
 * client components; a reserved key without a registered component falls back to Overview.
 */
import type { ComponentType } from "react";

export const DEMAND_EXTENSION_TAB_KEYS = [
  // Epic 38 (FR-194, FR-195): pinned and matching talent pools.
  "pools",
  // Epic 48: time-to-fill prediction panel.
  "predictions",
  // Epic 41: internal mobility (visibility, eligibility rules, internal applications).
  "mobility",
  // Epic 49: NYC Local Law 144 flag and notice period.
  "ll144",
  // Epic 56: Sourcing Agent shortlist.
  "agent_shortlist",
  // Epic 55: Demand Agent "AI assist" (suggestions, flags, SLA risk).
  "ai_assist",
  // Epic 70: "Job boards" (Board Postings of the demand).
  "job_boards",
] as const;
export type DemandExtensionTabKey = (typeof DEMAND_EXTENSION_TAB_KEYS)[number];

export type DemandTabProps = { demandId: string; demandStatus: string };

export type DemandExtensionTab = {
  key: DemandExtensionTabKey;
  label: string;
  /** Shown only when the user holds this permission (any of them, for an array). */
  permission?: string | readonly string[];
  /** Sort position among registered tabs (lower first); they render after the built-in tabs. */
  order?: number;
  component: ComponentType<DemandTabProps>;
};

const registry = new Map<DemandExtensionTabKey, DemandExtensionTab>();

/** Register (or replace) a Demand tab. Call from a module imported by `demand-detail.tsx`. */
export function registerDemandTab(tab: DemandExtensionTab): void {
  registry.set(tab.key, tab);
}

/** Registered tabs the user may see, in `order`. */
export function demandExtensionTabs(has: (permission: string) => boolean): DemandExtensionTab[] {
  return [...registry.values()]
    .filter((t) => {
      if (!t.permission) return true;
      const perms = typeof t.permission === "string" ? [t.permission] : t.permission;
      return perms.some(has);
    })
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

export function isDemandExtensionTabKey(value: unknown): value is DemandExtensionTabKey {
  return typeof value === "string" && (DEMAND_EXTENSION_TAB_KEYS as readonly string[]).includes(value);
}
