/** Pure helpers for the role editor's permission checklist (permission -> scope grants). */
import type { ModuleAppOut, ModuleCaps, PermissionOut, RoleOut, RoleUpdate } from "@/lib/api/types";

export type Grants = Record<string, string>;

export type PermissionGroup = { group: string; permissions: PermissionOut[] };

/** Group the catalog by `group`, keeping the catalog's order for groups and permissions. */
export function groupPermissions(catalog: readonly PermissionOut[]): PermissionGroup[] {
  const groups = new Map<string, PermissionOut[]>();
  for (const perm of catalog) {
    const list = groups.get(perm.group);
    if (list) list.push(perm);
    else groups.set(perm.group, [perm]);
  }
  return Array.from(groups, ([group, permissions]) => ({ group, permissions }));
}

/** Scope pre-selected when a permission is ticked: the narrowest one allowed (least privilege). */
export function defaultScope(perm: PermissionOut): string {
  return perm.scopes[0] ?? "tenant";
}

export function toggleGrant(grants: Grants, perm: PermissionOut, checked: boolean): Grants {
  const next = { ...grants };
  if (checked) next[perm.key] = grants[perm.key] ?? defaultScope(perm);
  else delete next[perm.key];
  return next;
}

export function setGrantScope(grants: Grants, perm: PermissionOut, scope: string): Grants {
  if (!perm.scopes.includes(scope)) return grants;
  return { ...grants, [perm.key]: scope };
}

/**
 * Tick or untick every permission of a group. Epic 14 (FR-81): ticking a group never adds a sensitive
 * permission; those are granted one by one.
 */
export function toggleGroup(grants: Grants, permissions: readonly PermissionOut[], checked: boolean): Grants {
  return permissions
    .filter((perm) => !checked || !perm.sensitive)
    .reduce((acc, perm) => toggleGrant(acc, perm, checked), grants);
}

/** Checkbox state for a group header: all ticked, none, or "mixed". */
export function groupState(grants: Grants, permissions: readonly PermissionOut[]): boolean | "mixed" {
  const selected = permissions.filter((p) => p.key in grants).length;
  if (selected === 0) return false;
  return selected === permissions.length ? true : "mixed";
}

export const ROLE_KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

/** Suggest a role key from a display name: `Senior Recruiter` -> `senior_recruiter`. */
export function roleKeyFromName(name: string): string {
  let key = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[^a-z]+/, "")
    .slice(0, 64)
    .replace(/_+$/, "");
  if (key.length === 1) key = `${key}_role`;
  return key;
}

export function sameGrants(a: Grants, b: Grants): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => b[k] === a[k]);
}

// ---------------------------------------------------------------- module capabilities (unified RBAC)

/** Caps granted for one app (empty array if none), normalized. */
function appCaps(caps: ModuleCaps, app: string): string[] {
  return caps[app] ?? [];
}

/** Tick or untick one capability of an app. Apps with no caps are dropped so the map stays canonical. */
export function toggleModuleCap(caps: ModuleCaps, app: string, cap: string, checked: boolean): ModuleCaps {
  const current = new Set(appCaps(caps, app));
  if (checked) current.add(cap);
  else current.delete(cap);
  const next = { ...caps };
  if (current.size === 0) delete next[app];
  else next[app] = Array.from(current);
  return next;
}

/** Tick or untick every capability of an app. */
export function toggleModuleApp(caps: ModuleCaps, app: ModuleAppOut, checked: boolean): ModuleCaps {
  const next = { ...caps };
  if (checked) next[app.key] = app.capabilities.map((c) => c.key);
  else delete next[app.key];
  return next;
}

/** Checkbox state for an app header: all ticked, none, or "mixed". */
export function moduleAppState(caps: ModuleCaps, app: ModuleAppOut): boolean | "mixed" {
  const granted = new Set(appCaps(caps, app.key));
  const total = app.capabilities.length;
  const selected = app.capabilities.filter((c) => granted.has(c.key)).length;
  if (selected === 0) return false;
  return selected === total ? true : "mixed";
}

export function hasModuleCap(caps: ModuleCaps, app: string, cap: string): boolean {
  return appCaps(caps, app).includes(cap);
}

/** Count of granted caps across all apps (for the section header). */
export function moduleCapCount(caps: ModuleCaps): number {
  return Object.values(caps).reduce((n, list) => n + list.length, 0);
}

export function sameModuleCaps(a: ModuleCaps, b: ModuleCaps): boolean {
  const apps = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const app of apps) {
    const sa = new Set(appCaps(a, app));
    const sb = appCaps(b, app);
    if (sa.size !== sb.length || !sb.every((c) => sa.has(c))) return false;
  }
  return true;
}

export type RoleDraft = {
  key: string;
  name: string;
  description: string;
  permissions: Grants;
  moduleCaps: ModuleCaps;
};

/** PATCH body with only the fields that changed (system roles never send `key`, immutable ones no grants). */
export function buildRoleUpdate(role: RoleOut, draft: RoleDraft): RoleUpdate {
  const body: RoleUpdate = {};
  const name = draft.name.trim();
  if (name && name !== role.name) body.name = name;
  const description = draft.description.trim() || null;
  if (description !== (role.description ?? null)) body.description = description;
  const key = draft.key.trim();
  if (!role.is_system && key && key !== role.key) body.key = key;
  if (!role.is_immutable && !sameGrants(draft.permissions, role.permissions)) body.permissions = draft.permissions;
  if (!role.is_immutable && !sameModuleCaps(draft.moduleCaps, role.module_caps ?? {})) {
    body.module_caps = draft.moduleCaps;
  }
  return body;
}
