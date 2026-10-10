/** Pure helpers for the user details drawer: only changed, permitted fields are sent. */
import type { AdminUserOut, UserUpdate } from "@/lib/api/types";

export type UserDraft = {
  name: string;
  roleIds: string[];
  businessUnitId: string | null;
  teamIds: string[];
};

export function sameIdSet(a: readonly string[], b: readonly string[]): boolean {
  const setA = new Set(a);
  const setB = new Set(b);
  return setA.size === setB.size && [...setA].every((id) => setB.has(id));
}

export function userDraft(user: AdminUserOut): UserDraft {
  return {
    name: user.name,
    roleIds: user.roles.map((r) => r.id),
    businessUnitId: user.business_unit?.id ?? null,
    teamIds: user.teams.map((t) => t.id),
  };
}

export type UserEditRights = {
  /** `team:manage` and not editing oneself (backend: 409 `self_scope_change`). */
  teams: boolean;
  /** `business_unit:manage` and not editing oneself. */
  businessUnit: boolean;
};

/** PATCH body for `/admin/users/{id}`; empty when nothing changed. */
export function buildUserUpdate(user: AdminUserOut, draft: UserDraft, rights: UserEditRights): UserUpdate {
  const original = userDraft(user);
  const body: UserUpdate = {};
  const name = draft.name.trim();
  if (name && name !== original.name) body.name = name;
  if (!sameIdSet(draft.roleIds, original.roleIds)) body.role_ids = [...new Set(draft.roleIds)];
  if (rights.businessUnit && draft.businessUnitId !== original.businessUnitId) {
    body.business_unit_id = draft.businessUnitId;
  }
  if (rights.teams && !sameIdSet(draft.teamIds, original.teamIds)) body.team_ids = [...new Set(draft.teamIds)];
  return body;
}

export function isEmptyUpdate(body: object): boolean {
  return Object.keys(body).length === 0;
}
