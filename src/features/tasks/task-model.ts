/** Pure task helpers: smart lists, overdue / due labels in a time zone, quick-add defaults, entity chips. */
import type { TaskOut, TaskPriority } from "@/lib/api/types";

export type SmartList = "my_day" | "overdue" | "upcoming" | "no_date" | "assigned_by_me" | "completed";

export const SMART_LISTS: { id: SmartList; label: string }[] = [
  { id: "my_day", label: "My Day" },
  { id: "overdue", label: "Overdue" },
  { id: "upcoming", label: "Upcoming" },
  { id: "no_date", label: "No date" },
  { id: "assigned_by_me", label: "Assigned by me" },
  { id: "completed", label: "Completed" },
];

export function isSmartList(v: unknown): v is SmartList {
  return SMART_LISTS.some((l) => l.id === v);
}

/** Query string (without `?`) for `GET /tasks` for a smart list. */
export function taskListQuery(list: SmartList, opts: { q?: string; page?: number; pageSize?: number } = {}): string {
  const p = new URLSearchParams();
  p.set("page", String(opts.page ?? 1));
  p.set("page_size", String(opts.pageSize ?? 100));
  if (list === "assigned_by_me") p.set("created_by", "me");
  else p.set("owner", "me");
  const view = { my_day: "today", overdue: "overdue", upcoming: "upcoming", no_date: "no_date", completed: "completed" } as const;
  if (list !== "assigned_by_me") p.set("view", view[list]);
  p.set("sort", list === "completed" ? "-created_at" : "due_at");
  const q = (opts.q ?? "").trim().slice(0, 200);
  if (q) p.set("q", q);
  return p.toString();
}

// ---------------------------------------------------------------- time zones
/** `YYYY-MM-DD` of `d` in `timeZone`. */
export function localDateKey(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Minutes `timeZone` is ahead of UTC at instant `utcMs`. */
function tzOffsetMinutes(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour") % 24, n("minute"), n("second"));
  return Math.round((asUtc - utcMs) / 60_000);
}

/** The UTC instant of wall-clock `dateKey` `hh:mm` in `timeZone`. */
export function zonedInstant(dateKey: string, time: string, timeZone: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  const first = guess - tzOffsetMinutes(guess, timeZone) * 60_000;
  // Re-check once across DST changes.
  return new Date(guess - tzOffsetMinutes(first, timeZone) * 60_000);
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** `HH:mm` of `d` in `timeZone`. */
export function localTime(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}

type DueFields = Pick<TaskOut, "status" | "due_at" | "due_all_day">;

/**
 * Mirrors the backend: an open timed task is overdue once `due_at` passed; an all-day task only after the
 * end of its due date in the owner's time zone.
 */
export function isOverdue(t: DueFields, now: Date, timeZone: string): boolean {
  if (t.status !== "open" || !t.due_at) return false;
  const due = new Date(t.due_at);
  if (Number.isNaN(due.getTime())) return false;
  if (t.due_all_day) return localDateKey(due, timeZone) < localDateKey(now, timeZone);
  return due.getTime() < now.getTime();
}

/** "Today", "Tomorrow", "Yesterday" or a short date, plus the time for timed tasks. */
export function dueLabel(t: Pick<TaskOut, "due_at" | "due_all_day">, now: Date, timeZone: string, locale?: string): string {
  if (!t.due_at) return "";
  const due = new Date(t.due_at);
  const key = localDateKey(due, timeZone);
  const today = localDateKey(now, timeZone);
  let day: string;
  if (key === today) day = "Today";
  else if (key === addDays(today, 1)) day = "Tomorrow";
  else if (key === addDays(today, -1)) day = "Yesterday";
  else
    day = new Intl.DateTimeFormat(locale, {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      ...(key.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}),
    }).format(due);
  if (t.due_all_day) return day;
  const time = new Intl.DateTimeFormat(locale, { timeZone, hour: "numeric", minute: "2-digit" }).format(due);
  return `${day} ${time}`;
}

/**
 * Due date for "Add a task" in a list: today (all day) in My Day, Overdue and Assigned by me, tomorrow in
 * Upcoming, none in No date. All-day dates are stored as local noon so any time zone maps to the same day.
 */
export function quickAddDue(list: SmartList, now: Date, timeZone: string): { due_at: string | null; due_all_day: boolean } {
  if (list === "no_date" || list === "completed") return { due_at: null, due_all_day: false };
  const today = localDateKey(now, timeZone);
  const day = list === "upcoming" ? addDays(today, 1) : today;
  return { due_at: zonedInstant(day, "12:00", timeZone).toISOString(), due_all_day: true };
}

// ---------------------------------------------------------------- display
export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITIES: TaskPriority[] = ["low", "normal", "high", "urgent"];

export const ENTITY_LABELS: Record<string, string> = {
  client: "Client",
  contact: "Contact",
  demand: "Demand",
  candidate: "Candidate",
  application: "Application",
};

/** Where a linked entity opens (contacts and applications have no page of their own). */
export function entityHref(type: string | null | undefined, id: string | null | undefined): string | null {
  if (!type || !id) return null;
  if (type === "candidate") return `/candidates/${id}`;
  if (type === "demand") return `/demands/${id}`;
  if (type === "client") return `/clients/${id}`;
  return null;
}

/** Reminder presets relative to the due time (minutes before). */
export const REMINDER_PRESETS: { minutes: number; label: string }[] = [
  { minutes: 0, label: "At due time" },
  { minutes: 15, label: "15 minutes before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 24 * 60, label: "1 day before" },
];

/** Complete / reopen applied locally (optimistic update). */
export function withStatus(t: TaskOut, done: boolean, now: Date, timeZone: string): TaskOut {
  const next: TaskOut = {
    ...t,
    status: done ? "done" : "open",
    completed_at: done ? now.toISOString() : null,
  };
  return { ...next, is_overdue: isOverdue(next, now, timeZone) };
}
