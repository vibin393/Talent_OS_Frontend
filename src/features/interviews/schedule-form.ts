/** Pure state, validation and payload mapping for the schedule / reschedule dialog. */
import { formatInZone, isValidTimeZone, minutesToTime, toUtcPreview } from "@/lib/time/zones";
import type { InterviewCreate, InterviewMode, InterviewOut, InterviewReschedule, ParticipantIn } from "./types";

export type Person = { id: string; name: string };

export type ScheduleValues = {
  stageId: string | null;
  date: string;
  time: string;
  duration: number;
  timezone: string;
  mode: InterviewMode;
  createOnlineMeeting: boolean;
  meetingUrl: string;
  location: string;
  interviewers: Person[];
  externals: string[];
  notes: string;
  sendInvites: boolean;
  allowPast: boolean;
};

export type ScheduleField = keyof ScheduleValues | "start";
export type ScheduleErrors = Partial<Record<ScheduleField, string>>;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/; // NOSONAR
const URL_RE = /^https?:\/\/\S+$/i;

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** 00:00, 00:15, … 23:45. */
export function timeOptions(step = 15): string[] {
  const out: string[] = [];
  for (let m = 0; m < 1440; m += step) out.push(minutesToTime(m));
  return out;
}

export const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 120, 180, 240];

/** Next quarter hour at least an hour from `now`, as local parts in `tz`. */
export function defaultStart(tz: string, now: number = Date.now()): { date: string; time: string } {
  const t = new Date(Math.ceil((now + 60 * 60_000) / (15 * 60_000)) * 15 * 60_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(t);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return { date: `${map.year}-${map.month}-${map.day}`, time: `${map.hour === "24" ? "00" : map.hour}:${map.minute}` };
}

export function emptySchedule(tz: string, durationMinutes = 60, now: number = Date.now()): ScheduleValues {
  const start = defaultStart(tz, now);
  return {
    stageId: null,
    date: start.date,
    time: start.time,
    duration: durationMinutes,
    timezone: tz,
    mode: "video",
    createOnlineMeeting: false,
    meetingUrl: "",
    location: "",
    interviewers: [],
    externals: [],
    notes: "",
    sendInvites: true,
    allowPast: false,
  };
}

/** Values for rescheduling an existing interview (same organiser zone, participants and link). */
export function valuesFromInterview(i: InterviewOut): ScheduleValues {
  const [date, time] = i.start_local.split("T");
  return {
    stageId: i.stage_id,
    date,
    time: (time ?? "").slice(0, 5),
    duration: i.duration_minutes,
    timezone: i.timezone,
    mode: i.mode,
    createOnlineMeeting: i.create_online_meeting,
    meetingUrl: i.create_online_meeting ? "" : (i.meeting_url ?? ""),
    location: i.location ?? "",
    interviewers: i.participants
      .filter((p) => p.kind === "interviewer_internal" && p.user_id)
      .map((p) => ({ id: p.user_id!, name: p.name || p.email })),
    externals: i.participants.filter((p) => p.kind === "interviewer_external").map((p) => p.email),
    notes: i.notes ?? "",
    sendInvites: true,
    allowPast: false,
  };
}

export type LinkFieldState = {
  /** The "Create Teams/Meet link" switch is shown (video interviews). */
  showSwitch: boolean;
  /** The switch can be turned on (the organiser has an active calendar connection). */
  switchEnabled: boolean;
  /** The pasted meeting-link input is shown. */
  showLinkInput: boolean;
  /** Location input for in-person interviews. */
  showLocation: boolean;
};

export function linkFieldState(mode: InterviewMode, organiserConnected: boolean, createOnline: boolean): LinkFieldState {
  const video = mode === "video";
  return {
    showSwitch: video,
    switchEnabled: video && organiserConnected,
    showLinkInput: video && !(organiserConnected && createOnline),
    showLocation: mode === "in_person",
  };
}

/** Client-side validation; the server re-validates everything (and owns the timezone conversion). */
const DEFAULT_SCHEDULE_OPTS: { requireStage: boolean; organiserConnected?: boolean; now?: number } = { requireStage: true };

export function validateSchedule(
  v: ScheduleValues,
  opts: { requireStage: boolean; organiserConnected?: boolean; now?: number } = DEFAULT_SCHEDULE_OPTS,
): ScheduleErrors {
  const e: ScheduleErrors = {};
  const now = opts.now ?? Date.now();
  if (opts.requireStage && !v.stageId) e.stageId = "Choose an interview stage";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) e.date = "Choose a date";
  if (!/^\d{1,2}:\d{2}$/.test(v.time)) e.time = "Choose a start time";
  if (!Number.isInteger(v.duration) || v.duration < 15 || v.duration > 480) e.duration = "Duration must be between 15 minutes and 8 hours";
  if (!isValidTimeZone(v.timezone)) e.timezone = "Choose a valid time zone";
  if (!e.date && !e.time && !e.timezone) {
    const utc = toUtcPreview(v.date, v.time, v.timezone);
    if (!utc) e.start = `That time does not exist in ${v.timezone} (daylight saving change). Pick another time.`;
    else if (Date.parse(utc) < now && !v.allowPast) e.start = "The start time is in the past. Pick a future time, or record a past interview.";
  }
  if (v.interviewers.length + v.externals.length === 0) e.interviewers = "Add at least one interviewer";
  const bad = v.externals.find((x) => !isEmail(x));
  if (bad) e.externals = `“${bad}” is not a valid email address`;
  const link = linkFieldState(v.mode, opts.organiserConnected ?? false, v.createOnlineMeeting);
  if (link.showLinkInput && v.meetingUrl.trim() && !URL_RE.test(v.meetingUrl.trim())) e.meetingUrl = "Enter a link starting with https://";
  return e;
}

function participants(v: ScheduleValues): ParticipantIn[] {
  return [
    ...v.interviewers.map<ParticipantIn>((p) => ({ kind: "interviewer_internal", user_id: p.id })),
    ...v.externals.map<ParticipantIn>((email) => ({ kind: "interviewer_external", email: email.trim().toLowerCase() })),
  ];
}

function linkParts(v: ScheduleValues, organiserConnected: boolean) {
  const link = linkFieldState(v.mode, organiserConnected, v.createOnlineMeeting);
  return {
    meeting_url: link.showLinkInput && v.meetingUrl.trim() ? v.meetingUrl.trim() : null,
    location: link.showLocation && v.location.trim() ? v.location.trim() : null,
    create_online_meeting: link.switchEnabled && v.createOnlineMeeting,
  };
}

export function toCreatePayload(v: ScheduleValues, organiserConnected: boolean): InterviewCreate {
  const { meeting_url, location, create_online_meeting } = linkParts(v, organiserConnected);
  return {
    stage_id: v.stageId!,
    start_local: `${v.date}T${v.time}`,
    timezone: v.timezone,
    duration_minutes: v.duration,
    mode: v.mode,
    meeting_url,
    location,
    notes: v.notes.trim() || null,
    create_online_meeting,
    send_invites: v.sendInvites,
    allow_past: v.allowPast,
    participants: participants(v),
  };
}

export function toReschedulePayload(v: ScheduleValues, organiserConnected: boolean, expectedVersion: number): InterviewReschedule {
  const { meeting_url, location } = linkParts(v, organiserConnected);
  return {
    start_local: `${v.date}T${v.time}`,
    timezone: v.timezone,
    duration_minutes: v.duration,
    expected_version: expectedVersion,
    participants: participants(v),
    mode: v.mode,
    meeting_url,
    location,
    notes: v.notes.trim() || null,
  };
}

/** "Candidate sees: Tue 6 Oct, 10:30 IST" preview lines, one per distinct participant time zone. */
export function previewLines(v: ScheduleValues, audiences: readonly { label: string; timezone: string | null | undefined }[]): string[] {
  const utc = toUtcPreview(v.date, v.time, v.timezone);
  if (!utc) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of audiences) {
    const tz = a.timezone && isValidTimeZone(a.timezone) ? a.timezone : v.timezone;
    const key = `${a.label}|${tz}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`${a.label} sees: ${formatInZone(utc, tz)}`);
  }
  return out;
}
