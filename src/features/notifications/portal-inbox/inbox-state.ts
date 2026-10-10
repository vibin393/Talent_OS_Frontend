/** Pure state helpers for the portal notification bell (optimistic read state). */
import type { PortalInbox, PortalNotificationPreference } from "./types";

/** Mark one notification read (no-op when it is already read or unknown); keeps `unread_count` in step. */
export function markOneRead(inbox: PortalInbox, id: string, at: string = new Date().toISOString()): PortalInbox {
  let changed = false;
  const items = inbox.items.map((n) => {
    if (n.id !== id || n.read_at) return n;
    changed = true;
    return { ...n, read_at: at };
  });
  if (!changed) return inbox;
  return { items, unread_count: Math.max(0, inbox.unread_count - 1) };
}

/** Mark every notification read. */
export function markEveryRead(inbox: PortalInbox, at: string = new Date().toISOString()): PortalInbox {
  return { items: inbox.items.map((n) => (n.read_at ? n : { ...n, read_at: at })), unread_count: 0 };
}

/** Apply an email preference change locally (mandatory types never change). */
export function setEmailPreference(
  prefs: readonly PortalNotificationPreference[],
  type: string,
  email: boolean,
): PortalNotificationPreference[] {
  return prefs.map((p) => (p.type === type && !p.mandatory ? { ...p, email } : p));
}

/**
 * The in-portal path of a notification link. Only same-origin paths under the portal's own area are
 * followed (External-Principal links never point into the internal app).
 */
export function portalLinkPath(link: string | null | undefined, areaPrefix: string): string | null {
  if (!link || !link.startsWith("/") || link.startsWith("//")) return null;
  return link === areaPrefix || link.startsWith(`${areaPrefix}/`) || link.startsWith(`${areaPrefix}?`) ? link : null;
}

/** Each portal's route area (links outside it are not followed). */
export const PORTAL_AREAS = { client: "/client", vendor: "/vendor", worker: "/portal" } as const;
