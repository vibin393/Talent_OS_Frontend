/** Pure notification helpers: badge text, poll config, day grouping, relative time. */
import type { NotificationChannel, NotificationOut } from "@/lib/api/types";

/** Unread badge text: the server caps the count at 100, the badge shows "99+" above 99. */
export function unreadBadgeText(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "";
  return count > 99 ? "99+" : String(Math.floor(count));
}

export function bellAriaLabel(count: number): string {
  const text = unreadBadgeText(count);
  return text ? `Notifications, ${text} unread` : "Notifications, no unread";
}

/** Unread-count polling: every 30 s while the tab is visible, again on focus, never in the background. */
export const UNREAD_POLL = {
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
  staleTime: 15_000,
} as const;

export type DayGroup = "Today" | "Yesterday" | "Earlier";

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Today / Yesterday / Earlier (in the viewer's local time), keeping order and dropping empty groups. */
export function groupByDay<T extends Pick<NotificationOut, "created_at">>(
  items: readonly T[],
  now: Date,
): { group: DayGroup; items: T[] }[] {
  const today = dayKey(now);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yesterday = dayKey(y);
  const buckets: Record<DayGroup, T[]> = { Today: [], Yesterday: [], Earlier: [] };
  for (const item of items) {
    const k = dayKey(new Date(item.created_at));
    buckets[k === today ? "Today" : k === yesterday ? "Yesterday" : "Earlier"].push(item);
  }
  return (["Today", "Yesterday", "Earlier"] as const)
    .filter((g) => buckets[g].length > 0)
    .map((group) => ({ group, items: buckets[group] }));
}

/** "Just now", "5m ago", "3h ago", "2d ago", else a short date. */
export function relativeTime(iso: string, now: Date, locale?: string): string {
  const t = new Date(iso);
  const s = Math.round((now.getTime() - t.getTime()) / 1000);
  if (Number.isNaN(s)) return "";
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)}d ago`;
  return t.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

/** Only app-relative links are followed from a notification. */
export function safeLinkPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  both: "In-app and email",
  in_app: "In-app only",
  email: "Email only",
  off: "Off",
};

export const CHANNELS: NotificationChannel[] = ["both", "in_app", "email", "off"];
