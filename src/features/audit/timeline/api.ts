import { api } from "@/lib/api/client";
import type { TimelinePage } from "./types";

export const TIMELINE_PAGE_SIZE = 25;

export function timelineQuery(subjectType: string, subjectId: string, cursor: string | null, limit = TIMELINE_PAGE_SIZE): string {
  const p = new URLSearchParams({ subject_type: subjectType, subject_id: subjectId, limit: String(limit) });
  if (cursor) p.set("cursor", cursor);
  return p.toString();
}

export const auditTimelineApi = {
  page: (subjectType: string, subjectId: string, cursor: string | null, signal?: AbortSignal) =>
    api.get<TimelinePage>(`/api/v1/audit/timeline?${timelineQuery(subjectType, subjectId, cursor)}`, { signal }),
};

export const auditTimelineKeys = {
  subject: (subjectType: string, subjectId: string) => ["audit", "timeline", subjectType, subjectId] as const,
};
