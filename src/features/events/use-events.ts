"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { eventKeys, eventsApi } from "./api";
import type { EventOut, EventStatus, StationOut } from "./types";

export function useEventPermissions() {
  const canManage = usePermission("event:manage");
  const campusRead = usePermission("campus:read");
  return { canManage, canRead: canManage || campusRead };
}

export function useEvents(status: EventStatus | "", enabled = true) {
  return useQuery({
    queryKey: eventKeys.list(status),
    queryFn: ({ signal }) => eventsApi.list(status, signal),
    placeholderData: (prev) => prev,
    enabled,
  });
}

export function useEvent(id: string | null) {
  return useQuery({ queryKey: eventKeys.detail(id ?? ""), queryFn: ({ signal }) => eventsApi.get(id ?? "", signal), enabled: Boolean(id) });
}

export function useStations(id: string, enabled = true) {
  return useQuery({ queryKey: eventKeys.stations(id), queryFn: ({ signal }) => eventsApi.stations(id, signal), enabled });
}

/** Mutation returning the event: caches it and refreshes lists. */
export function useEventMutation<V>(fn: (v: V) => Promise<EventOut>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (ev) => {
      qc.setQueryData(eventKeys.detail(ev.id), ev);
      await qc.invalidateQueries({ queryKey: [...eventKeys.all, "list"] });
    },
  });
}

export function useStationMutation<V>(eventId: string, fn: (v: V) => Promise<StationOut>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: eventKeys.stations(eventId) }),
        qc.invalidateQueries({ queryKey: eventKeys.detail(eventId) }),
      ]);
    },
  });
}

/** Refresh the live views (queue, dashboard, check-ins) after an action. */
export function useRefreshLive(eventId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["campus-events", "live", eventId] });
}
