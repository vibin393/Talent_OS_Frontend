"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { benchApi, benchKeys } from "./api";
import type { ReviewDecision } from "./types";

const POLL_MS = 10_000;
const POLL_WINDOW_MS = 60_000;

/** Bench section of a demand's Matching tab; refetches every 10 s (for up to 1 min) while scores are pending. */
export function useBenchMatches(demandId: string, enabled = true) {
  const [startedAt] = useState(() => Date.now());
  return useQuery({
    queryKey: benchKeys.matches(demandId),
    queryFn: ({ signal }) => benchApi.matches(demandId, signal),
    enabled,
    retry: false,
    refetchInterval: (q) =>
      q.state.data?.items.some((i) => i.score_pending) && Date.now() - startedAt < POLL_WINDOW_MS ? POLL_MS : false,
  });
}

export function useBenchReviewMutations(demandId: string) {
  const qc = useQueryClient();
  const done = () => {
    void qc.invalidateQueries({ queryKey: benchKeys.matches(demandId) });
    void qc.invalidateQueries({ queryKey: ["matching", "demand", demandId] });
  };
  return {
    review: useMutation({
      mutationFn: ({ candidateId, decision, reason }: { candidateId: string; decision: ReviewDecision; reason: string | null }) =>
        benchApi.review(demandId, candidateId, decision, reason),
      onSuccess: done,
    }),
    complete: useMutation({ mutationFn: () => benchApi.completeReview(demandId), onSuccess: done }),
  };
}
