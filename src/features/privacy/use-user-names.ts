"use client";

import { useQuery } from "@tanstack/react-query";
import { adminApi, adminKeys, LOOKUP_PAGE_SIZE } from "@/features/admin/api";
import { EMPTY_USER_FILTERS } from "@/features/admin/query";
import { usePermission } from "@/features/auth/use-permission";

/** id -> display name for the tenant's users (first 100; empty without `user:read`). */
export function useUserNames(): (id: string | null | undefined) => string | null {
  const canRead = usePermission("user:read");
  const users = useQuery({
    queryKey: [...adminKeys.users, "names"],
    queryFn: ({ signal }) => adminApi.listUsers({ ...EMPTY_USER_FILTERS, status: "all" }, 1, LOOKUP_PAGE_SIZE, signal),
    enabled: canRead,
    staleTime: 5 * 60_000,
  });
  const map = new Map((users.data?.items ?? []).map((u) => [u.id, u.name || u.email]));
  return (id) => (id ? (map.get(id) ?? null) : null);
}
