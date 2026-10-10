"use client";

import { useMutation } from "@tanstack/react-query";
import { useAppToast } from "@/components/toast";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { ApplicationTransitionIn } from "@/lib/api/types";
import { pipelineApi } from "./api";
import { pipelineErrorMessage } from "./transitions";
import { useInvalidatePipeline } from "./use-pipeline";

/** A user-facing message for a pipeline API error. */
export function pipelineError(e: unknown): string {
  return isApiError(e) ? pipelineErrorMessage(e.code, errorMessage(e)) : errorMessage(e);
}

/** Single-application transition (board drop, drawer and card menus). Invalidates every pipeline view. */
export function useTransitionApplication(demandId: string | null) {
  const invalidate = useInvalidatePipeline();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ApplicationTransitionIn }) => pipelineApi.transition(id, body),
    onSettled: () => invalidate(demandId),
  });
}

/** Confirm or dismiss a client's link-sourced rejection (`rejected_pending`). */
export function usePendingRejection(demandId: string | null) {
  const toast = useAppToast();
  const invalidate = useInvalidatePipeline();
  const confirm = useMutation({
    mutationFn: (feedbackId: string) => pipelineApi.confirmRejection(feedbackId),
    onSuccess: () => toast.success("Rejection confirmed. The candidate moved to Rejected."),
    onError: (e) => toast.error(pipelineError(e)),
    onSettled: () => invalidate(demandId),
  });
  const dismiss = useMutation({
    mutationFn: (feedbackId: string) => pipelineApi.dismissRejection(feedbackId),
    onSuccess: () => toast.info("Client rejection dismissed."),
    onError: (e) => toast.error(pipelineError(e)),
    onSettled: () => invalidate(demandId),
  });
  return { confirm, dismiss, busy: confirm.isPending || dismiss.isPending };
}
