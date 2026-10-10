"use client";

import { useQuery } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { crmApi, crmKeys } from "./api";

export function useCrmDashboard(params: { from: string; to: string; ownerIds: string[]; teamId: string | null }) {
  const canRead = usePermission("opportunity:read");
  return useQuery({
    queryKey: crmKeys.dashboard(params.from, params.to, params.ownerIds, params.teamId),
    queryFn: ({ signal }) => crmApi.dashboard(params, signal),
    enabled: canRead && !!params.from && !!params.to,
    placeholderData: (prev) => prev,
  });
}
