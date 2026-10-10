"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { activityKeys } from "@/features/activity/api";
import { usePermission } from "@/features/auth/use-permission";
import type { DemandOut, DemandUpdate, TransitionIn } from "@/lib/api/types";
import { demandKeys, demandsApi } from "./api";

export function useDemand(id: string) {
  const canRead = usePermission("demand:read");
  return useQuery({
    queryKey: demandKeys.detail(id),
    queryFn: ({ signal }) => demandsApi.get(id, signal),
    enabled: canRead,
  });
}

export function useReasonCodes(enabled = true) {
  return useQuery({
    queryKey: demandKeys.reasonCodes,
    queryFn: ({ signal }) => demandsApi.reasonCodes(signal),
    enabled,
    staleTime: Infinity,
  });
}

/** Invalidate everything about one demand plus the lists and its timeline. */
export function useInvalidateDemand() {
  const queryClient = useQueryClient();
  return (id: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: demandKeys.demand(id) }),
      queryClient.invalidateQueries({ queryKey: demandKeys.lists }),
      queryClient.invalidateQueries({ queryKey: activityKeys.timeline("demands", id) }),
    ]);
}

function useDemandMutation<V>(id: string, fn: (vars: V) => Promise<DemandOut>) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateDemand();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (demand) => {
      queryClient.setQueryData(demandKeys.detail(id), demand);
      await invalidate(id);
    },
  });
}

export function useUpdateDemand(id: string) {
  return useDemandMutation(id, (body: DemandUpdate) => demandsApi.update(id, body));
}

export function useSubmitDemand(id: string) {
  return useDemandMutation(id, () => demandsApi.submit(id));
}

export function useTransitionDemand(id: string) {
  return useDemandMutation(id, (body: TransitionIn) => demandsApi.transition(id, body));
}

export function useConfirmAiFields(id: string) {
  return useDemandMutation(id, (fields?: string[]) => demandsApi.confirmAiFields(id, fields));
}

export function useArchiveDemand(id: string) {
  return useDemandMutation(id, () => demandsApi.archive(id));
}
