"use client";

import { useQuery } from "@tanstack/react-query";
import { adminApi, adminKeys, LOOKUP_PAGE_SIZE } from "@/features/admin/api";
import { EMPTY_USER_FILTERS } from "@/features/admin/query";
import { useMe } from "@/features/auth/use-me";
import { usePermission } from "@/features/auth/use-permission";

/**
 * Resolve user ids to display names for approval history and My approvals. The approvals API returns
 * ids only; names come from the admin user list when the viewer has `user:read` (first 100 users),
 * and the signed-in user is always "You".
 */
export function useUserNames(): (id: string | null | undefined) => string | null {
  const { data: me } = useMe();
  const canRead = usePermission("user:read");
  const users = useQuery({
    queryKey: [...adminKeys.users, "names"],
    queryFn: ({ signal }) => adminApi.listUsers({ ...EMPTY_USER_FILTERS, status: "all" }, 1, LOOKUP_PAGE_SIZE, signal),
    enabled: canRead,
    staleTime: 5 * 60_000,
  });
  const names = new Map((users.data?.items ?? []).map((u) => [u.id, u.name || u.email]));
  return (id) => {
    if (!id) return null;
    if (me && id === me.user.id) return "You";
    return names.get(id) ?? null;
  };
}
