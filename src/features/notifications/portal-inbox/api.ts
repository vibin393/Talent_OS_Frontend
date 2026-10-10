import { clientPortalRequest } from "@/lib/api/client-portal-client";
import { portalRequest } from "@/lib/api/portal-client";
import { vendorPortalRequest } from "@/lib/api/vendor-portal-client";
import type { PortalInbox, PortalKind, PortalNotification, PortalNotificationPreference } from "./types";

const enc = encodeURIComponent;

/** Base path of each portal's notification inbox. */
export const PORTAL_INBOX_BASE: Record<PortalKind, string> = {
  client: "/api/v1/client-portal/notifications",
  vendor: "/api/v1/vendor-portal/notifications",
  worker: "/api/v1/portal/work/notifications",
};

type Req = <T>(path: string, options?: { method?: "GET" | "POST" | "PATCH"; body?: unknown; signal?: AbortSignal }) => Promise<T>;

/** Each portal's own session transport (its 401 goes to that portal's sign-in). */
const REQUEST: Record<PortalKind, Req> = {
  client: clientPortalRequest,
  vendor: vendorPortalRequest,
  worker: portalRequest,
};

export function portalInboxApi(portal: PortalKind) {
  const B = PORTAL_INBOX_BASE[portal];
  const req = REQUEST[portal];
  return {
    // The inbox list lives at the base path itself; the portal transports require a `<prefix>/` path, which it is.
    list: (signal?: AbortSignal) => req<PortalInbox>(B, { signal }),
    markRead: (id: string) => req<PortalNotification>(`${B}/${enc(id)}/read`, { method: "POST" }),
    markAllRead: () => req<unknown>(`${B}/read-all`, { method: "POST" }),
    preferences: (signal?: AbortSignal) => req<PortalNotificationPreference[]>(`${B}/preferences`, { signal }),
    setPreference: (type: string, email: boolean) =>
      req<PortalNotificationPreference[] | PortalNotificationPreference>(`${B}/preferences`, { method: "PATCH", body: { type, email } }),
  };
}

export const portalInboxKeys = {
  inbox: (portal: PortalKind) => ["portal-inbox", portal, "list"] as const,
  preferences: (portal: PortalKind) => ["portal-inbox", portal, "preferences"] as const,
};
