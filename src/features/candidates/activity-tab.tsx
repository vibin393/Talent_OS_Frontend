"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ActivityTimeline } from "@/features/activity/activity-timeline";
import { candidateKeys } from "./api";

/** Notes & Activity: the Epic 2 composer + timeline for this candidate (`/candidates/{id}/timeline`). */
export function ActivityTab({ candidateId }: { candidateId: string }) {
  const queryClient = useQueryClient();
  return (
    <ActivityTimeline
      entityType="candidates"
      entityId={candidateId}
      onChanged={() => queryClient.invalidateQueries({ queryKey: candidateKeys.detail(candidateId) })}
    />
  );
}
