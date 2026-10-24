"use client";

import { useQuery } from "@tanstack/react-query";
import { calendarApi, calendarKeys } from "@/features/calendar/api";

/** Free/busy for `userIds` between two UTC instants (Outlook scheduling-assistant data). */
export function useFreeBusy(userIds: readonly string[], startUtc: string | null, endUtc: string | null, enabled = true) {
  const ids = [...new Set(userIds)].sort((x, y) => (String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0));
  return useQuery({
    queryKey: calendarKeys.freeBusy(ids, startUtc ?? "", endUtc ?? ""),
    queryFn: ({ signal }) => calendarApi.freeBusy({ user_ids: ids, start_utc: startUtc!, end_utc: endUtc! }, signal),
    enabled: enabled && ids.length > 0 && !!startUtc && !!endUtc,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}
