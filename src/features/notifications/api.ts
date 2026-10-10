import { api } from "@/lib/api/client";
import type {
  NotificationOut,
  NotificationPreferencesIn,
  NotificationPreferencesOut,
  Page,
  UnreadCountOut,
} from "@/lib/api/types";

const enc = encodeURIComponent;
const N = "/api/v1/notifications";

export const NOTIFICATIONS_PAGE_SIZE = 20;

/** In-app notifications and preferences (Epic 10, story 10.3). Always the caller's own. */
export const notificationsApi = {
  list: (page: number, unreadOnly: boolean, signal?: AbortSignal) =>
    api.get<Page<NotificationOut>>(
      `${N}?page=${page}&page_size=${NOTIFICATIONS_PAGE_SIZE}${unreadOnly ? "&unread_only=true" : ""}`,
      { signal },
    ),
  unreadCount: (signal?: AbortSignal) => api.get<UnreadCountOut>(`${N}/unread-count`, { signal }),
  markRead: (id: string) => api.post<NotificationOut>(`${N}/${enc(id)}/read`),
  markAllRead: () => api.post<UnreadCountOut>(`${N}/read-all`),
  remove: (id: string) => api.delete<void>(`${N}/${enc(id)}`),
  preferences: (signal?: AbortSignal) =>
    api.get<NotificationPreferencesOut>("/api/v1/me/notification-preferences", { signal }),
  savePreferences: (body: NotificationPreferencesIn) =>
    api.put<NotificationPreferencesOut>("/api/v1/me/notification-preferences", body),
};

export const notificationKeys = {
  all: ["notifications"] as const,
  unread: ["notifications", "unread-count"] as const,
  list: (unreadOnly: boolean) => ["notifications", "list", unreadOnly] as const,
  preferences: ["notifications", "preferences"] as const,
};
