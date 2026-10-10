"use client";

import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { type InterviewRange, interviewKeys, interviewsApi, PIPELINE_ROOTS } from "./api";
import type { StageOutcomeIn } from "./types";

/** Refresh every interview view plus the pipeline / demand views that show interview state. */
export async function invalidateInterviews(qc: QueryClient): Promise<void> {
  await Promise.all([
    qc.invalidateQueries({ queryKey: interviewKeys.all }),
    ...PIPELINE_ROOTS.map((key) => qc.invalidateQueries({ queryKey: key })),
  ]);
}

export function useDemandInterviews(demandId: string, range: InterviewRange) {
  const enabled = usePermission("interview:read");
  return useQuery({
    queryKey: interviewKeys.demand(demandId, range),
    queryFn: ({ signal }) => interviewsApi.forDemand(demandId, range, signal),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useApplicationInterviews(applicationId: string) {
  const enabled = usePermission("interview:read");
  return useQuery({
    queryKey: interviewKeys.application(applicationId),
    queryFn: ({ signal }) => interviewsApi.forApplication(applicationId, signal),
    enabled,
  });
}

export function useInterviewSummary(applicationId: string) {
  const enabled = usePermission("interview:read");
  return useQuery({
    queryKey: interviewKeys.summary(applicationId),
    queryFn: ({ signal }) => interviewsApi.summary(applicationId, signal),
    enabled,
  });
}

export function useMyInterviews(range: InterviewRange) {
  return useQuery({
    queryKey: interviewKeys.mine(range),
    queryFn: ({ signal }) => interviewsApi.mine(range, signal),
    placeholderData: (prev) => prev,
  });
}

export function useInterview(id: string) {
  return useQuery({ queryKey: interviewKeys.one(id), queryFn: ({ signal }) => interviewsApi.get(id, signal) });
}

export function useCancelInterview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => interviewsApi.cancel(id, reason),
    onSuccess: () => invalidateInterviews(qc),
  });
}

export function useInterviewStatusAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "no_show" | "complete" }) =>
      action === "no_show" ? interviewsApi.noShow(id) : interviewsApi.complete(id),
    onSuccess: () => invalidateInterviews(qc),
  });
}

export function useRecordOutcome(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StageOutcomeIn) => interviewsApi.recordOutcome(applicationId, body),
    onSuccess: () => invalidateInterviews(qc),
  });
}

export function useSelectApplication(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => interviewsApi.select(applicationId),
    onSuccess: () => invalidateInterviews(qc),
  });
}

export function useRejectReasons(enabled: boolean) {
  return useQuery({
    queryKey: interviewKeys.rejectReasons,
    queryFn: ({ signal }) => interviewsApi.rejectReasons(signal),
    enabled,
    staleTime: 5 * 60_000,
  });
}
