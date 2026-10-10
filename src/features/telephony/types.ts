/** Epic 76 telephony DTOs (hand-written; mirror `app/schemas/telephony.py`). No phone numbers beyond `last4`. */

export type RefusalCode =
  | "human_only_action"
  | "ecosystem_suspended"
  | "no_voice_provider"
  | "call_phone_not_verified"
  | "voice_consent_required"
  | "do_not_call"
  | "outside_calling_hours"
  | "call_in_progress"
  | "cost_cap_reached"
  | "no_phone";

export type CallStatus =
  | "requested"
  | "refused"
  | "dialing_recruiter"
  | "dialing_candidate"
  | "in_progress"
  | "completed"
  | "no_answer"
  | "busy"
  | "failed"
  | "cancelled";

export type RecordingReason = "policy_not_permitted" | "consent_missing" | "notice_unavailable" | "provider_unsupported";

export interface CallOptions {
  can_call: boolean;
  refusal_code: RefusalCode | null;
  refusal_message: string | null;
  next_window_at: string | null;
  provider_key: string | null;
  caller_id_label: string | null;
  recording_will_be: "recorded" | "not_recorded";
  recording_reason: RecordingReason | null;
  consent: { voice_screening: boolean; call_recording: boolean };
  phone_verified: boolean;
  phone_last4: string | null;
  today_cost_pct: number;
  voice_session_id: string | null;
  manual_available: boolean;
}

export interface VoiceCall {
  id: string;
  human_id: string;
  voice_session_id: string;
  application_id: string | null;
  candidate_id: string | null;
  placed_by: string;
  provider_key: string;
  status: CallStatus;
  refusal_code: string | null;
  failure_code: string | null;
  recorded: boolean;
  recording_unavailable_reason: RecordingReason | null;
  recording_status: "none" | "pending" | "stored" | "failed" | "skipped";
  transcript_status: "none" | "queued" | "running" | "completed" | "failed" | "skipped";
  provider_delete_status: string;
  requested_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_s: number | null;
  billable_minutes: number | null;
  cost_estimate_minor: number | null;
  manual_instructions: string | null;
}

export interface CallPhone {
  status: "none" | "pending" | "verified";
  last4: string | null;
  verified_at: string | null;
  verification_method: string | null;
  otp_expires_at: string | null;
}

export interface TelephonySettings {
  call_window_start: string;
  call_window_end: string;
  daily_cost_cap_minor: number;
  cost_alert_pct: number;
  max_concurrent_per_user: number;
  max_call_minutes: number;
  recording_notice_text: string;
  stt_enabled: boolean;
  stt_language_hints: string[];
  auto_transcribe_uploads: boolean;
}

export interface TelephonyNumber {
  id: string;
  installation_id: string;
  legal_entity_id: string | null;
  provider_key: string;
  number_e164: string;
  label: string | null;
  regulatory_ref: string | null;
  rate_per_minute_minor: number;
  status: "active" | "inactive";
  created_at: string;
}

export interface TelephonyNumberIn {
  installation_id: string;
  legal_entity_id?: string | null;
  number_e164: string;
  label?: string | null;
  regulatory_ref?: string | null;
  rate_per_minute_minor: number;
}

export interface UsageRow {
  key: string;
  label: string | null;
  calls: number;
  minutes: number;
  stt_minutes: number;
  cost_estimate_minor: number;
}

export interface Usage {
  from_date: string;
  to_date: string;
  group_by: "user" | "legal_entity" | "day";
  rows: UsageRow[];
  today_cost_minor: number;
  daily_cost_cap_minor: number;
  today_cost_pct: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
