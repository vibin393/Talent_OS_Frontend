"use client";

import { ActivityTimeline } from "@/features/activity/activity-timeline";

/** Notes, calls, meetings and system entries (status changes, approvals) for the demand. */
export function ActivityTab({ demandId, onChanged }: { demandId: string; onChanged?: () => void }) {
  return <ActivityTimeline entityType="demands" entityId={demandId} onChanged={onChanged} />;
}
