"use client";

import { useQuery } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { workflowApi, workflowKeys } from "./api";

/** Triggers, fields, operators and action parameter schemas for the builder. */
export function useWorkflowRegistry() {
  const canRead = usePermission("workflow:read");
  return useQuery({
    queryKey: workflowKeys.registry,
    queryFn: ({ signal }) => workflowApi.registry(signal),
    enabled: canRead,
    staleTime: 10 * 60_000,
  });
}

export function useWorkflowRules(includeArchived: boolean) {
  const canRead = usePermission("workflow:read");
  return useQuery({
    queryKey: workflowKeys.ruleList(includeArchived),
    queryFn: ({ signal }) => workflowApi.listRules(includeArchived, signal),
    enabled: canRead,
  });
}

export function useWorkflowRule(id: string | null) {
  return useQuery({
    queryKey: workflowKeys.rule(id ?? ""),
    queryFn: ({ signal }) => workflowApi.getRule(id ?? "", signal),
    enabled: !!id,
  });
}

/** Pipeline stages (for `move_stage` targets). */
export function usePipelineStages(enabled: boolean) {
  return useQuery({
    queryKey: workflowKeys.stages,
    queryFn: ({ signal }) => workflowApi.stages(signal),
    enabled,
    staleTime: 10 * 60_000,
  });
}
