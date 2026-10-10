/**
 * Client 360 tab registry (Epic 16). Phase 2 domains add their Client 360 tabs here instead of editing
 * `client-360.tsx`: Commercials registers Billing profile, Contracts, Rate cards and POs; Placements,
 * Timesheets, Invoices, Payments and the AR summary are registered by their epics (hidden until registered).
 *
 * The keys are reserved up front (data only) so the server page can parse `?tab=` without loading the
 * client components; a reserved key without a registered component falls back to Overview.
 */
import type { ComponentType } from "react";

export const EXTENSION_TAB_KEYS = [
  "billing-profile",
  "contracts",
  "rate-cards",
  "purchase-orders",
  "placements",
  "timesheets",
  "invoices",
  "payments",
  "ar",
  // Epic 14 (FR-78): Client User access.
  "portal-access",
  // Epic 18 (FR-103): compliance packs published to the Client Portal.
  "compliance-packs",
  // Epic 50 (FR-250..252): Client Portal SSO.
  "single-sign-on",
  // Epic 45: SOW projects of the client.
  "projects",
  // Epic 61: per-client submission rules (Submission Agent).
  "submission-rules",
] as const;
export type ExtensionTabKey = (typeof EXTENSION_TAB_KEYS)[number];

export type Client360TabProps = { clientId: string; clientName: string; clientArchived: boolean };

export type Client360Tab = {
  key: ExtensionTabKey;
  label: string;
  /** Shown only when the user holds this permission (any of them, for an array). */
  permission?: string | readonly string[];
  /** Sort position among registered tabs (lower first). */
  order?: number;
  component: ComponentType<Client360TabProps>;
};

const registry = new Map<ExtensionTabKey, Client360Tab>();

/** Register (or replace) a Client 360 tab. Call from a module imported by `client-360.tsx`. */
export function registerClient360Tab(tab: Client360Tab): void {
  registry.set(tab.key, tab);
}

/** Registered tabs the user may see, in `order`. */
export function client360Tabs(has: (permission: string) => boolean): Client360Tab[] {
  return [...registry.values()]
    .filter((t) => {
      if (!t.permission) return true;
      const perms = typeof t.permission === "string" ? [t.permission] : t.permission;
      return perms.some(has);
    })
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

export function isExtensionTabKey(value: unknown): value is ExtensionTabKey {
  return typeof value === "string" && (EXTENSION_TAB_KEYS as readonly string[]).includes(value);
}
