"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { interviewKeys, interviewsApi } from "./api";
import type { PlanStageIn } from "./types";

export function useInterviewPlan(demandId: string) {
  const enabled = usePermission("interview:schedule");
  return useQuery({
    queryKey: interviewKeys.plan(demandId),
    queryFn: ({ signal }) => interviewsApi.plan(demandId, signal),
    enabled,
  });
}

export function useKits(includeArchived = false) {
  const canSchedule = usePermission("interview:schedule");
  const canConfigure = usePermission("interview:configure");
  const enabled = canSchedule || canConfigure;
  return useQuery({
    queryKey: [...interviewKeys.kits, includeArchived],
    queryFn: ({ signal }) => interviewsApi.kits(includeArchived, signal),
    enabled,
    staleTime: 60_000,
  });
}

export function useStageTemplates(includeArchived = false) {
  const canSchedule = usePermission("interview:schedule");
  const canConfigure = usePermission("interview:configure");
  const enabled = canSchedule || canConfigure;
  return useQuery({
    queryKey: [...interviewKeys.templates, includeArchived],
    queryFn: ({ signal }) => interviewsApi.templates(includeArchived, signal),
    enabled,
    staleTime: 60_000,
  });
}

export function useSavePlan(demandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stages: PlanStageIn[]) => interviewsApi.savePlan(demandId, stages),
    onSuccess: (plan) => qc.setQueryData(interviewKeys.plan(demandId), plan),
  });
}

export function useApplyTemplate(demandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => interviewsApi.applyTemplate(demandId, templateId),
    onSuccess: (plan) => qc.setQueryData(interviewKeys.plan(demandId), plan),
  });
}
