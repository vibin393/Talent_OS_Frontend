"use client";

import { useQuery } from "@tanstack/react-query";
import { notificationKeys, notificationsApi } from "./api";
import { UNREAD_POLL } from "./format";

/** Unread notification count for the bell (polls every 30 s while visible; no WebSocket / SSE). */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: ({ signal }) => notificationsApi.unreadCount(signal),
    ...UNREAD_POLL,
  });
}
