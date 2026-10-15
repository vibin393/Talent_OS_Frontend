"use client";

import { useQuery } from "@tanstack/react-query";
import { entitlementsApi, entitlementKeys } from "./api";

/** The signed-in tenant's plan + enabled modules (Phase 2). Plans change rarely, so cache generously. */
export function useEntitlements() {
  return useQuery({
    queryKey: entitlementKeys.me,
    queryFn: ({ signal }) => entitlementsApi.me(signal),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
