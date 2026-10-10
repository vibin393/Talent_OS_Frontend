"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { interviewsApi } from "./api";
import type { InterviewCreate, InterviewReschedule } from "./types";
import { invalidateInterviews } from "./use-interviews";

/** Schedule a new interview for an application, or reschedule an existing one. */
export function useScheduleInterview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      args: { kind: "create"; applicationId: string; body: InterviewCreate } | { kind: "reschedule"; id: string; body: InterviewReschedule },
    ) => (args.kind === "create" ? interviewsApi.schedule(args.applicationId, args.body) : interviewsApi.reschedule(args.id, args.body)),
    onSuccess: () => invalidateInterviews(qc),
  });
}
