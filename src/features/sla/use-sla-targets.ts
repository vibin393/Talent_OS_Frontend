"use client";

import { useQuery } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { slaApi, slaKeys } from "./api";

/** Phase 2 SLA targets (`sla:read`). */
export function useSlaTargets() {
  const canRead = usePermission("sla:read");
  return useQuery({ queryKey: slaKeys.targets, queryFn: ({ signal }) => slaApi.targets(signal), enabled: canRead });
}

/** The milestone registry (with each entry's `available` flag). */
export function useSlaMilestones() {
  const canRead = usePermission("sla:read");
  return useQuery({
    queryKey: slaKeys.milestones,
    queryFn: ({ signal }) => slaApi.milestones(signal),
    enabled: canRead,
    staleTime: 10 * 60_000,
  });
}

/** Clocks of one subject (list badges, detail panes). */
export function useSlaClocks(subjectType: string, subjectId: string | null) {
  return useQuery({
    queryKey: slaKeys.clocks(subjectType, subjectId ?? ""),
    queryFn: ({ signal }) => slaApi.clocks(subjectType, subjectId ?? "", signal),
    enabled: !!subjectId,
  });
}
