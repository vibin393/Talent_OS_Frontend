/** Epic 58 Voice Screening DTOs (hand-written, mirrors `app/schemas/voice.py` and `voice_public.py`). */

export type ConsentState = "granted" | "refused" | "pending";
export type VoiceSessionStatus =
  | "planned"
  | "consent_pending"
  | "scheduled"
  | "in_progress"
  | "uploaded"
  | "processing"
  | "ready_for_review"
  | "reviewed"
  | "failed"
  | "cancelled";

export type VoiceSession = {
  id: string;
  human_id: string;
  application_id: string | null;
  candidate_id: string;
  mode: "call" | "upload";
  provider_key: string;
  status: VoiceSessionStatus;
  external_ref: string | null;
  voice_consent: ConsentState;
  recording_consent: ConsentState;
  jurisdiction: string | null;
  recording_rule: string | null;
  recording_allowed: boolean;
  recording_block_reason: "not_permitted" | "missing_consent" | null;
  has_recording: boolean;
  recording_media_type: string | null;
  recording_deleted_at: string | null;
  has_transcript: boolean;
  transcript_id: string | null;
  transcript_source: string | null;
  needs_speaker_label: boolean;
  questionnaire_id: string | null;
  questionnaire_version: number | null;
  summary: string | null;
  gaps: unknown[];
  failure_code: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_s: number | null;
  requested_by: string | null;
  owner_user_id: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  screening_id: string | null;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
};

export type VoiceSessionRequestIn = { mode: "call" | "upload"; provider_key?: "manual" | "fake" | null; script_ref?: string | null };

export type TranscriptSegment = { seq: number; speaker_role: string; start_ms: number | null; end_ms: number | null; text: string };
export type VoiceTranscript = { transcript_id: string; status: string; segments: TranscriptSegment[] };
export type Playback = { url: string; expires_in: number; media_type: string | null };

export type VoiceSettings = {
  default_provider: "manual" | "fake";
  consent_link_days: number;
  consent_channel_order: ("email" | "whatsapp" | "sms")[];
  max_upload_mb: number;
  fake_available: boolean;
};

export type VoiceNotice = { purpose: "voice_screening" | "call_recording"; title: string; body: string };
export type VoiceConsentView = {
  tenant_name: string | null;
  recruiter_name: string | null;
  candidate_first_name: string | null;
  demand_title: string | null;
  notices: VoiceNotice[];
  country: string | null;
  region: string | null;
  voice_screening: ConsentState;
  call_recording: ConsentState;
  answered: boolean;
  expires_at: string | null;
};
export type VoiceConsentIn = { country: string; region?: string | null; voice_screening: boolean; call_recording: boolean };
