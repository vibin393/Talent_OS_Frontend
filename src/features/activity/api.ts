import { api } from "@/lib/api/client";
import type { ActivityCreate, ActivityOut, ActivityUpdate, TimelinePage } from "@/lib/api/types";

const enc = encodeURIComponent;

export const TIMELINE_PAGE_SIZE = 20;

/**
 * Generic activity API (Epic 2). `entity` is the URL segment of a registered entity type: the plural
 * (`clients`, `contacts`, `candidates`) or the singular type (`client`, `candidate`); both resolve.
 */
export const activityApi = {
  timeline: (entity: string, id: string, cursor: string | null, signal?: AbortSignal) => {
    const params = new URLSearchParams({ limit: String(TIMELINE_PAGE_SIZE) });
    if (cursor) params.set("cursor", cursor);
    return api.get<TimelinePage>(`/api/v1/${enc(entity)}/${enc(id)}/timeline?${params}`, { signal });
  },
  add: (entity: string, id: string, body: ActivityCreate) =>
    api.post<ActivityOut>(`/api/v1/${enc(entity)}/${enc(id)}/activities`, body),
  update: (activityId: string, body: ActivityUpdate) =>
    api.patch<ActivityOut>(`/api/v1/activities/${enc(activityId)}`, body),
};

export const activityKeys = {
  all: ["activity"] as const,
  timeline: (entity: string, id: string) => ["activity", "timeline", entity, id] as const,
};
