/** Pure helpers for API keys (Epic 12 story 12.7, FR-75). */
import type { PermissionMap } from "@/features/auth/permissions";

/** Permissions that can never be delegated to an API key (mirrors the backend `NON_DELEGABLE`). */
export const NON_DELEGABLE_SCOPES: ReadonlySet<string> = new Set([
  "api_key:manage",
  "support_access:approve",
  "dsr:process",
  "role:manage",
  "user:manage",
  "settings:manage",
  "privacy:manage",
  "retention:manage",
]);

/**
 * Scopes the creator may give a key: permissions they hold, minus the non-delegable ones. When the
 * server's `delegable-scopes` list is loaded it is intersected as well (it is authoritative).
 */
export function delegableScopes(held: PermissionMap, serverList?: readonly string[] | null): string[] {
  const mine = Object.keys(held ?? {}).filter((p) => !NON_DELEGABLE_SCOPES.has(p));
  const allowed = serverList ? mine.filter((p) => serverList.includes(p)) : mine;
  return [...new Set(allowed)].sort();
}

export type ScopeGroup = { resource: string; label: string; scopes: string[] };

const RESOURCE_LABELS: Record<string, string> = {
  candidate: "Candidates",
  client: "Clients",
  contact: "Contacts",
  demand: "Demands",
  activity: "Activity",
  application: "Applications",
  submission: "Submissions",
  consent: "Consent",
  dsr: "Data subject requests",
  ai_log: "AI action log",
  audit: "Audit log",
  team: "Teams",
  business_unit: "Business units",
  skill: "Skills",
  file: "Files",
};

export function resourceLabel(resource: string): string {
  return RESOURCE_LABELS[resource] ?? resource.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** Scopes grouped by resource (`candidate:read` -> "Candidates"), groups and scopes sorted. */
export function groupScopes(scopes: readonly string[]): ScopeGroup[] {
  const groups = new Map<string, string[]>();
  for (const s of scopes) {
    const resource = s.includes(":") ? s.slice(0, s.indexOf(":")) : s;
    groups.set(resource, [...(groups.get(resource) ?? []), s]);
  }
  return [...groups.entries()]
    .map(([resource, list]) => ({ resource, label: resourceLabel(resource), scopes: [...list].sort() }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Group checkbox state for a resource: all, some ("mixed") or none of its scopes selected. */
export function groupState(group: ScopeGroup, selected: ReadonlySet<string>): boolean | "mixed" {
  const n = group.scopes.filter((s) => selected.has(s)).length;
  return n === 0 ? false : n === group.scopes.length ? true : "mixed";
}

/** Display form of a key: the full key is never stored, only its prefix. */
export function maskedKey(prefix: string): string {
  return `tos_${prefix}…`;
}

/** The show-once dialog may close only after the user confirmed they copied the key. */
export function canCloseShowOnce(acknowledged: boolean): boolean {
  return acknowledged;
}

export const ROTATE_GRACE_OPTIONS = [
  { hours: 0, label: "Immediately" },
  { hours: 1, label: "1 hour" },
  { hours: 24, label: "24 hours" },
  { hours: 48, label: "48 hours" },
  { hours: 72, label: "72 hours" },
] as const;

export const RATE_LIMIT_MIN = 60;
export const RATE_LIMIT_MAX = 6000;
export const RATE_LIMIT_DEFAULT = 600;

export const KEY_STATUS_COLORS: Record<string, "success" | "danger" | "subtle" | "warning"> = {
  active: "success",
  revoked: "danger",
  expired: "subtle",
};
