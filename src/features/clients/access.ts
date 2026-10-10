import { hasPermission, type PermissionMap } from "@/features/auth/permissions";

/**
 * Whether to offer an action needing `perm` on a record owned by `ownerId`. With `own` scope only the
 * owner's records qualify; wider scopes (team/bu/tenant) are offered and the backend decides (403 is
 * reported like any other error).
 */
export function canActOnOwned(
  permissions: PermissionMap,
  perm: string,
  ownerId: string | null | undefined,
  meId: string | null | undefined,
): boolean {
  if (!hasPermission(permissions, perm)) return false;
  if (hasPermission(permissions, perm, "team")) return true;
  return !!meId && ownerId === meId;
}
