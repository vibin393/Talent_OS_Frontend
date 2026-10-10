/** Pure logic of Epic 43 recruitment events: labels, ETA text, check-in token parsing and queue views. */
import type { EventKind, EventStatus, NotifyChannel, QueueEntryOut, QueueOut, QueueStatus, StationOut } from "./types";

type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";

export const KIND_LABELS: Record<EventKind, string> = {
  job_fair: "Job fair",
  walk_in: "Walk-in drive",
  hackathon: "Hackathon",
  virtual: "Virtual event",
  campus: "Campus event",
};
export const EVENT_KINDS = Object.keys(KIND_LABELS) as EventKind[];

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = { draft: "Draft", open: "Registration open", live: "Live", closed: "Closed", cancelled: "Cancelled" };
export const EVENT_STATUS_COLORS: Record<EventStatus, BadgeColor> = { draft: "subtle", open: "success", live: "important", closed: "informative", cancelled: "danger" };
export const EVENT_STATUSES = Object.keys(EVENT_STATUS_LABELS) as EventStatus[];

export const CHANNEL_LABELS: Record<NotifyChannel, string> = { sms: "SMS", whatsapp: "WhatsApp", none: "No messages (board only)" };

export const QUEUE_STATUS_LABELS: Record<QueueStatus, string> = {
  waiting: "Waiting",
  called: "Called",
  in_interview: "In interview",
  done: "Done",
  skipped: "Skipped",
  left: "Left",
};

/** Event lifecycle actions available from `status`. */
export function eventActions(status: EventStatus): ("open" | "go_live" | "close" | "cancel")[] {
  switch (status) {
    case "draft":
      return ["open", "cancel"];
    case "open":
      return ["go_live", "cancel"];
    case "live":
      return ["close"];
    default:
      return [];
  }
}

/** Human ETA: "Now", "About 5 min", "About 1 h 10 min"; null/negative -> "—". */
export function formatEta(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes) || minutes < 0) return "—";
  const m = Math.round(minutes);
  if (m === 0) return "Now";
  if (m < 60) return `About ${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `About ${h} h ${rest} min` : `About ${h} h`;
}

/** Short wait text for a queue entry: position plus ETA. */
export function waitText(e: Pick<QueueEntryOut, "ahead" | "eta_minutes">): string {
  const ahead = e.ahead ?? 0;
  const who = ahead === 0 ? "Next" : `${ahead} ahead`;
  return `${who} · ${formatEta(e.eta_minutes)}`;
}

/**
 * The check-in token in what a QR scanner (or a person) gives us: a check-in URL (`…/campus/e/<token>`,
 * `…/l/<token>`, or `?token=`), or the bare token. Null when nothing token-like is found.
 */
export function parseCheckinToken(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const url = new URL(s);
    const q = url.searchParams.get("token");
    if (q) return q.length >= 20 ? q : null;
    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return last && last.length >= 20 ? decodeURIComponent(last) : null;
  } catch {
    return /^[A-Za-z0-9_\-.~]{20,2000}$/.test(s) ? s : null;
  }
}

export type BoardView = { calling: QueueEntryOut[]; waiting: QueueEntryOut[]; inInterview: QueueEntryOut[] };

/** The queue board: called (now calling), waiting by position, in interview. */
export function boardView(q: Pick<QueueOut, "entries">): BoardView {
  const by = (s: QueueStatus) => q.entries.filter((e) => e.status === s).sort((a, b) => a.position - b.position);
  return { calling: by("called"), waiting: by("waiting"), inInterview: by("in_interview") };
}

/** Board name shown publicly: first name + last initial (no full names on a screen in a hall). */
export function boardName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Candidate";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/** The entry a station is handling now (called or in interview), if any. */
export function currentEntry(q: Pick<QueueOut, "entries">, station: Pick<StationOut, "id" | "current_entry_id">): QueueEntryOut | null {
  if (station.current_entry_id) {
    const e = q.entries.find((x) => x.id === station.current_entry_id);
    if (e) return e;
  }
  return q.entries.find((e) => e.station_id === station.id && (e.status === "called" || e.status === "in_interview")) ?? null;
}

/** `datetime-local` values (browser zone) -> ISO, or null. */
export function localToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
