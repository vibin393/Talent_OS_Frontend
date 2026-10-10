"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { type CalendarProvider, calendarApi, calendarKeys } from "./api";

export function useCalendarProviders() {
  const enabled = usePermission("connection:manage_own");
  return useQuery({
    queryKey: calendarKeys.providers,
    queryFn: ({ signal }) => calendarApi.providers(signal),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useConnections() {
  const enabled = usePermission("connection:manage_own");
  return useQuery({
    queryKey: calendarKeys.mine,
    queryFn: ({ signal }) => calendarApi.connections(signal),
    enabled,
    staleTime: 60_000,
  });
}

/** Start the OAuth flow: the browser leaves for the provider and returns to `/settings/connections`. */
export function useConnect() {
  return useMutation({
    mutationFn: (provider: CalendarProvider) => calendarApi.start(provider),
    onSuccess: ({ authorize_url }) => {
      window.location.assign(authorize_url);
    },
  });
}

export function useDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => calendarApi.disconnect(id),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: calendarKeys.all }),
        // The compose dialog (Epic 10) keys its "From" line on the same endpoint.
        qc.invalidateQueries({ queryKey: ["comms", "connections"] }),
      ]);
    },
  });
}
