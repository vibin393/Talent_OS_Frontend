"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clientKeys } from "@/features/clients/api";
import { demandKeys } from "@/features/demands/api";
import { usePermission } from "@/features/auth/use-permission";
import type { PipelineReasonKind } from "@/lib/api/types";
import { pipelineApi, pipelineKeys } from "./api";

/** Stages (+ the transition list for drop-target validity). */
export function useStages(withTransitions = true) {
  return useQuery({
    queryKey: pipelineKeys.stages(withTransitions),
    queryFn: ({ signal }) => pipelineApi.stages(withTransitions, signal),
    staleTime: 5 * 60_000,
  });
}

export function useReasonCodes(kind: PipelineReasonKind | null, includeArchived = false, enabled = true) {
  return useQuery({
    queryKey: pipelineKeys.reasons(kind, includeArchived),
    queryFn: ({ signal }) => pipelineApi.reasonCodes(kind, includeArchived, signal),
    staleTime: 5 * 60_000,
    enabled,
  });
}

/** Tenant pipeline settings (needs `pipeline:configure`; other users get the defaults the UI assumes). */
export function usePipelineSettings() {
  const canConfigure = usePermission("pipeline:configure");
  return useQuery({
    queryKey: pipelineKeys.settings,
    queryFn: ({ signal }) => pipelineApi.settings(signal),
    enabled: canConfigure,
    staleTime: 5 * 60_000,
  });
}

export function useBoard(demandId: string, q: string) {
  const canRead = usePermission("application:read");
  return useQuery({
    queryKey: pipelineKeys.boardQuery(demandId, q),
    queryFn: ({ signal }) => pipelineApi.board(demandId, q, signal),
    enabled: canRead,
    placeholderData: (prev) => prev,
  });
}

export function useApplication(id: string | null) {
  return useQuery({
    queryKey: pipelineKeys.applicationDetail(id ?? ""),
    queryFn: ({ signal }) => pipelineApi.application(id!, signal),
    enabled: !!id,
  });
}

export function useDemandSubmissions(demandId: string, enabled = true) {
  const canRead = usePermission("submission:read");
  return useQuery({
    queryKey: pipelineKeys.submissions(demandId),
    queryFn: ({ signal }) => pipelineApi.submissions(demandId, signal),
    enabled: canRead && enabled,
  });
}

/**
 * Refresh every view touched by a pipeline change: the demand's board / list / submissions, open
 * application drawers, Candidate 360 applications, the demand record (Demand Progress) and Client 360.
 */
export function useInvalidatePipeline() {
  const queryClient = useQueryClient();
  return (demandId?: string | null) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: demandId ? pipelineKeys.board(demandId) : pipelineKeys.boardAll }),
      queryClient.invalidateQueries({ queryKey: ["pipeline", "application"] }),
      queryClient.invalidateQueries({ queryKey: ["pipeline", "candidate"] }),
      queryClient.invalidateQueries({ queryKey: ["pipeline", "submission"] }),
      demandId ? queryClient.invalidateQueries({ queryKey: demandKeys.demand(demandId) }) : undefined,
      queryClient.invalidateQueries({ queryKey: demandKeys.lists }),
      queryClient.invalidateQueries({ queryKey: [...clientKeys.all, "detail"] }),
    ]);
}
