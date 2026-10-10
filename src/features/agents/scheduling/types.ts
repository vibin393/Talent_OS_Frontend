/** Epic 59 Scheduling Agent DTOs (hand-mirrored from `app/schemas/scheduling_agent.py` / `scheduling_public.py`). */

export type RequestStatus =
  | "open"
  | "slots_offered"
  | "picked"
  | "booked"
  | "counter_proposed"
  | "handed_off"
  | "cancelled"
  | "expired";
export type InterviewMode = "video" | "phone" | "in_person";
export type WorkingHours = Partial<Record<Weekday, [string, string][]>>;
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface RequestStartIn {
  stage_id: string;
  participant_user_ids?: string[];
  duration_minutes?: number;
  mode?: InterviewMode;
  candidate_timezone?: string;
}

export interface RequestOptionsOut {
  agent_on: boolean;
  stage_id: string;
  stage_name: string;
  duration_minutes: number;
  candidate_timezone: string;
  timezone_source: string;
  open_request_id: string | null;
}

export interface OfferSlotOut {
  index: number;
  start: string;
  end: string;
  all_known_free: boolean;
  unknown_participants: string[];
}

export interface OfferOut {
  id: string;
  round: number;
  status: string;
  partial: boolean;
  channel: string | null;
  slots: OfferSlotOut[];
  unknown_participants: string[];
  sent_at: string | null;
  expires_at: string | null;
  picked_index: number | null;
  picked_at: string | null;
  counter_windows: { start: string; end: string }[] | null;
  candidate_note: string | null;
}

export interface HistoryOut {
  id: string;
  kind: string;
  actor_kind: string;
  actor_id: string | null;
  detail: Record<string, unknown>;
  at: string;
}

export interface ParticipantRef {
  user_id: string;
  name: string | null;
  timezone: string;
  calendar_connected: boolean;
}

export interface RequestOut {
  id: string;
  human_id: string;
  application_id: string;
  candidate_id: string;
  demand_id: string;
  stage_id: string;
  stage_name: string | null;
  interview_id: string | null;
  kind: "new" | "reschedule";
  status: RequestStatus;
  round: number;
  max_rounds: number;
  duration_minutes: number;
  buffer_minutes: number;
  participant_user_ids: string[];
  mode: string | null;
  candidate_timezone: string;
  owner_user_id: string;
  current_run_id: string | null;
  booked_interview_id: string | null;
  handoff_reason: string | null;
  reschedule_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequestDetailOut extends RequestOut {
  participants: ParticipantRef[];
  offers: OfferOut[];
  history: HistoryOut[];
}

export interface SchedulingPrefsIn {
  timezone: string;
  working_hours: WorkingHours;
  holiday_country?: string | null;
  holiday_region?: string | null;
  max_interviews_per_day?: number | null;
  buffer_minutes?: number | null;
}

export interface SchedulingPrefsOut extends Required<SchedulingPrefsIn> {
  user_id: string;
  is_default: boolean;
  calendar_connected: boolean;
}

export interface SchedulingSettingsOut {
  max_slots: number;
  horizon_business_days: number;
  slot_step_minutes: 15 | 30 | 60;
  default_buffer_minutes: number;
  candidate_hours: { start: string; end: string };
  max_rounds: number;
  link_days: number;
  reminder_offsets_minutes: number[];
  reminder_channels: ("email" | "whatsapp")[];
  scorecard_nudge_after_hours: number;
  scorecard_nudge_max: number;
  default_working_hours: WorkingHours;
  whatsapp_template_id: string | null;
  agent_on: boolean;
}

export type SchedulingSettingsIn = Partial<Omit<SchedulingSettingsOut, "agent_on">>;

// ---------------------------------------------------------------- candidate side
export type PickStatus = "open" | "picked" | "booked" | "counter_proposed" | "expired" | "closed";

export interface PublicSlot {
  index: number;
  start: string;
  end: string;
}

export interface SlotPickView {
  offer_id: string | null;
  tenant: string | null;
  demand_title: string | null;
  stage_name: string | null;
  duration: number;
  mode: string | null;
  slots: PublicSlot[];
  candidate_timezone: string;
  status: PickStatus;
  expires_at: string | null;
  booked_start: string | null;
  picked_index: number | null;
  notice: "slot_taken" | "new_options" | null;
}

export interface PickResultOut {
  status: PickStatus;
  deduplicated: boolean;
  view: SlotPickView;
}

export interface CounterWindowIn {
  start: string;
  end: string;
}
