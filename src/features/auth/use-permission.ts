"use client";

import { hasPermission, type Scope } from "./permissions";
import { useMe } from "./use-me";

/** Whether the signed-in user holds `perm` (optionally at `minScope` or wider). False while loading. */
export function usePermission(perm: string, minScope?: Scope): boolean {
  const { data: me } = useMe();
  return hasPermission(me?.permissions, perm, minScope);
}

/** The signed-in user's permission map (empty while loading). */
export function usePermissions(): Record<string, string> {
  const { data: me } = useMe();
  return me?.permissions ?? {};
}
