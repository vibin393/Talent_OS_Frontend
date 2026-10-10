/**
 * Hand-written DTOs of Epic 43 recruitment events (`app/schemas/campus.py`, events section). Served under
 * `/api/v1/campus/events/*`. Do not regenerate from the OpenAPI schema.
 */
import type { DemandRef } from "@/features/campus/types";

export type EventKind = "job_fair" | "walk_in" | "hackathon" | "virtual" | "campus";
export type EventStatus = "draft" | "open" | "live" | "closed" | "cancelled";
export type NotifyChannel = "sms" | "whatsapp" | "none";
export type CheckinStatus = "registered" | "checked_in" | "no_show" | "left";
export type StationStatus = "open" | "paused" | "closed";
export type QueueStatus = "waiting" | "called" | "in_interview" | "done" | "skipped" | "left";

export type EventIn = {
  name: string;
  kind: EventKind;
  drive_id?: string | null;
  demand_ids?: string[];
  starts_at: string;
  ends_at: string;
  timezone?: string;
  venue?: string | null;
  video_link?: string | null;
  avg_interview_minutes?: number | null;
  notify_channel?: NotifyChannel;
};

export type EventPatch = Partial<Omit<EventIn, "kind" | "drive_id">>;

export type EventCounts = { registered: number; checked_in: number; waiting: number; in_interview: number; interviewed: number };

export type EventOut = {
  id: string;
  name: string;
  kind: EventKind;
  drive_id: string | null;
  owner_id: string;
  demands: DemandRef[];
  starts_at: string;
  ends_at: string;
  timezone: string;
  venue: string | null;
  video_link: string | null;
  status: EventStatus;
  registration_url: string | null;
  avg_interview_minutes: number;
  notify_channel: NotifyChannel;
  station_count: number;
  counts: EventCounts;
  cancel_reason: string | null;
  created_at: string;
};

export type StationIn = { label: string; interviewer_user_ids?: string[]; demand_id?: string | null };
export type StationPatch = Partial<StationIn> & { status?: StationStatus };

export type StationOut = {
  id: string;
  event_id: string;
  label: string;
  interviewer_user_ids: string[];
  demand_id: string | null;
  status: StationStatus;
  current_entry_id?: string | null;
};

export type WalkInIn = { full_name: string; email: string; phone?: string | null };

/** Exactly one of `token`, `candidate_id` or `walk_in`. */
export type CheckInIn = { token?: string; candidate_id?: string; walk_in?: WalkInIn; demand_id?: string | null };

export type CheckinOut = {
  id: string;
  event_id: string;
  candidate_id: string;
  candidate_name: string | null;
  demand_id: string | null;
  demand_title: string | null;
  status: CheckinStatus;
  method: string;
  registered_at: string;
  checked_in_at: string | null;
  queue_entry_id?: string | null;
  queue_position?: number | null;
  queue_status?: QueueStatus | null;
};

export type QueueEntryOut = {
  id: string;
  position: number;
  candidate_id: string;
  candidate_name: string | null;
  demand_id: string | null;
  demand_title: string | null;
  status: QueueStatus;
  station_id: string | null;
  station_label: string | null;
  application_id: string | null;
  interview_id: string | null;
  ahead?: number | null;
  eta_minutes?: number | null;
  called_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  notified_at: string | null;
  notify_result: string | null;
};

export type QueueOut = {
  event_id: string;
  status: EventStatus;
  open_stations: number;
  median_minutes: number;
  waiting: number;
  entries: QueueEntryOut[];
  stations: StationOut[];
  generated_at: string;
};

export type EventDashboardOut = {
  event_id: string;
  registered: number;
  checked_in: number;
  waiting: number;
  called: number;
  in_interview: number;
  interviewed: number;
  skipped: number;
  left: number;
  average_wait_minutes: number | null;
  outcomes: Record<string, number>;
};

export type EventCheckinsOut = { items: CheckinOut[]; total: number };
