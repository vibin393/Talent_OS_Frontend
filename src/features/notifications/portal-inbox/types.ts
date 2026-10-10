/** Epic 35 B7: portal notification inbox (Client, Vendor and Worker portals). Hand-written API types. */

export type PortalKind = "client" | "vendor" | "worker";

export type PortalNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export type PortalInbox = { items: PortalNotification[]; unread_count: number };

export type PortalNotificationPreference = { type: string; label: string; email: boolean; mandatory: boolean };
