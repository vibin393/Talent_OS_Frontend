/** Epic 59 Scheduling Agent: pure helpers (labels, time rendering, counter-proposal validation). Unit-tested. */
import { localParts, timeToMinutes, toUtcPreview } from "@/lib/time/zones";
import type { HistoryOut, RequestStatus, Weekday, WorkingHours } from "./types";

export type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";

export const STATUS_BADGES: Record<RequestStatus, { label: string; color: BadgeColor }> = {
  open: { label: "Open", color: "informative" },
  slots_offered: { label: "Slots offered", color: "brand" },
  picked: { label: "Picked", color: "brand" },
  booked: { label: "Booked", color: "success" },
  counter_proposed: { label: "Counter-proposed", color: "warning" },
  handed_off: { label: "Handed off", color: "important" },
  cancelled: { label: "Cancelled", color: "subtle" },
  expired: { label: "Expired", color: "subtle" },
};

export const OPEN_STATUSES: readonly RequestStatus[] = ["open", "slots_offered", "picked", "counter_proposed"];

export function isOpen(status: RequestStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export const MODE_LABELS: Record<string, string> = { video: "Video call", phone: "Phone", in_person: "In person" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function clock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}:00 ${suffix}` : `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "Tue 14 Oct, 3:00–4:00 pm" for a slot shown in `tz` (both ends in the same zone). */
export function slotLabel(start: string, end: string, tz: string): string {
  const a = localParts(start, tz);
  const b = localParts(end, tz);
  const [, m, d] = a.date.split("-");
  const date = `${a.weekday} ${Number(d)} ${MONTHS[Number(m) - 1]}`;
  const from = clock(a.minutes);
  const to = clock(b.minutes);
  const sameHalf = from.slice(-2) === to.slice(-2);
  return `${date}, ${sameHalf ? from.slice(0, -3) : from}–${to}`;
}

/** History timeline label of one event. */
export function historyLabel(e: Pick<HistoryOut, "kind" | "detail">): string {
  const d = e.detail ?? {};
  switch (e.kind) {
    case "requested":
      return "Scheduling requested";
    case "slots_computed":
      return d.partial ? "Partial options computed" : `Slots computed (${String(d.slots ?? 0)})`;
    case "offered":
      return d.round && Number(d.round) > 1 ? `New options sent (round ${String(d.round)})` : "Slots offered";
    case "picked":
      return "Candidate picked a time";
    case "counter_proposed":
      return "Candidate suggested other times";
    case "booked":
      return d.human_id ? `Booked ${String(d.human_id)}` : "Booked";
    case "rescheduled":
      return "Interview rescheduled";
    case "conflict":
      return "Conflict — new options sent";
    case "handed_off":
      return "Handed off to you";
    case "cancelled":
      return "Request cancelled";
    case "expired":
      return "Link expired";
    case "availability_requested":
      return "Availability requested";
    default:
      return e.kind.replace(/_/g, " ");
  }
}

export interface CounterRow {
  date: string;
  from: string;
  to: string;
}

export interface CounterValidation {
  windows: { start: string; end: string }[];
  errors: string[];
}

/**
 * "Suggest up to 3 times": each row (date + from/to in `tz`) must be complete, in the future, at least `duration`
 * minutes long and inside the candidate hours; at most 3 rows.
 */
const DEFAULT_COUNTER_HOURS = { start: "00:00", end: "24:00" };

export function validateCounter(
  rows: CounterRow[],
  tz: string,
  duration: number,
  now: number = Date.now(),
  hours: { start: string; end: string } = DEFAULT_COUNTER_HOURS,
): CounterValidation {
  const errors: string[] = [];
  const windows: { start: string; end: string }[] = [];
  const filled = rows.filter((r) => r.date || r.from || r.to);
  if (filled.length === 0) errors.push("Suggest at least one time.");
  if (filled.length > 3) errors.push("Suggest up to 3 times.");
  const lo = timeToMinutes(hours.start);
  const hi = hours.end === "24:00" ? 1440 : timeToMinutes(hours.end);
  filled.slice(0, 3).forEach((r, i) => {
    const n = i + 1;
    if (!r.date || !r.from || !r.to) {
      errors.push(`Time ${n}: choose a date, a start and an end.`);
      return;
    }
    const start = toUtcPreview(r.date, r.from, tz);
    const end = toUtcPreview(r.date, r.to, tz);
    if (!start || !end) {
      errors.push(`Time ${n}: that time does not exist in this time zone.`);
      return;
    }
    if (Date.parse(start) <= now) {
      errors.push(`Time ${n}: choose a time in the future.`);
      return;
    }
    if (Date.parse(end) - Date.parse(start) < duration * 60_000) {
      errors.push(`Time ${n}: allow at least ${duration} minutes.`);
      return;
    }
    if (timeToMinutes(r.from) < lo || timeToMinutes(r.to) > hi) {
      errors.push(`Time ${n}: choose a time between ${hours.start} and ${hours.end}.`);
      return;
    }
    windows.push({ start, end });
  });
  return { windows, errors };
}

export const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

/** Problems of a working-hours editor value (each interval HH:MM, start before end). */
export function workingHoursErrors(hours: WorkingHours): string[] {
  const out: string[] = [];
  for (const { key, label } of WEEKDAYS) {
    for (const [a, b] of hours[key] ?? []) {
      const s = timeToMinutes(a);
      const e = b === "24:00" ? 1440 : timeToMinutes(b);
      if (Number.isNaN(s) || Number.isNaN(e)) out.push(`${label}: use HH:MM times.`);
      else if (s >= e) out.push(`${label}: the end must be after the start.`);
    }
  }
  return out;
}

/** Reminder offset chip label: 1440 -> "24 h", 60 -> "1 h", 30 -> "30 min". */
export function offsetLabel(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  return `${minutes} min`;
}
