"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { interviewKeys, interviewsApi } from "./api";
import type { ScorecardDraftIn } from "./types";
import { invalidateInterviews } from "./use-interviews";

export function useMyScorecard(interviewId: string) {
  return useQuery({
    queryKey: interviewKeys.myScorecard(interviewId),
    queryFn: ({ signal }) => interviewsApi.myScorecard(interviewId, signal),
    retry: false,
  });
}

/** Other interviewers' scorecards; the server blinds them (`hidden: true`) until yours is submitted. */
export function useScorecards(interviewId: string, enabled = true) {
  return useQuery({
    queryKey: interviewKeys.scorecards(interviewId),
    queryFn: ({ signal }) => interviewsApi.scorecards(interviewId, signal),
    enabled,
  });
}

export function useSaveScorecard(interviewId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, submit }: { body: ScorecardDraftIn; submit: boolean }) =>
      submit ? interviewsApi.submitMyScorecard(interviewId, body) : interviewsApi.saveMyScorecard(interviewId, body),
    onSuccess: async (card, { submit }) => {
      qc.setQueryData(interviewKeys.myScorecard(interviewId), card);
      if (submit) await invalidateInterviews(qc);
    },
  });
}
