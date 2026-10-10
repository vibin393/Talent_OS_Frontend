import type { ActivityKind, ActivityOut } from "@/lib/api/types";

export const USER_ACTIVITY_KINDS = ["note", "call", "meeting"] as const;
export type UserActivityKind = (typeof USER_ACTIVITY_KINDS)[number];

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  note: "Note",
  call: "Call",
  meeting: "Meeting",
  email: "Email",
  system: "Update",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Value for an `<input type="datetime-local">` in the browser's time zone (minutes precision). */
export function toLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** ISO timestamp for a `datetime-local` value, or null when empty/invalid. */
export function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** "Just now", "5 min ago", "3 h ago", else a short date/time; `now` is injectable for tests. */
export function formatWhen(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = now.getTime() - d.getTime();
  if (diff >= 0 && diff < 60_000) return "Just now";
  if (diff >= 0 && diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff >= 0 && diff < 24 * 3_600_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Who wrote an entry: the author's name, "You", or "System" for system/email entries without author. */
export function authorLabel(a: Pick<ActivityOut, "author_id" | "author_name" | "kind">, meId?: string): string {
  if (a.author_id && a.author_id === meId) return "You";
  if (a.author_name) return a.author_name;
  return a.kind === "system" || a.kind === "email" ? "System" : "Unknown user";
}

/** "Ann Lee, Bob" from an entry's participants (named ones only). */
export function participantsLabel(participants: ActivityOut["participants"]): string {
  return participants
    .map((p) => p.name?.trim())
    .filter((n): n is string => !!n)
    .join(", ");
}
