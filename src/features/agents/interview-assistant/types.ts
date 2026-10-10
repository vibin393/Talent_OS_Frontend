/** Hand-written DTOs of the Epic 60 Interview Assistant endpoints (`app/schemas/interview_captures.py`,
 * `app/schemas/interview_capture_public.py`). */

export type CaptureStatus = "not_requested" | "planned" | "consent_pending" | "blocked" | "uploaded" | "processing" | "ready" | "erased";
export type ConsentState = "agreed" | "waiting" | "refused";

export type ParticipantConsent = {
  participant_id: string | null;
  kind: "candidate" | "internal" | "external";
  name: string;
  user_id?: string | null;
  state: ConsentState;
};

export type CaptureStatusOut = {
  interview_id: string;
  capture_id: string | null;
  status: CaptureStatus;
  capture_kind: "recording" | "transcript" | "both" | null;
  offered: boolean;
  reasons: string[];
  reason_texts: string[];
  participants: ParticipantConsent[];
  jurisdiction: string | null;
  recording_rule: string | null;
  uploaded_at: string | null;
  unknown_speakers: string[];
  failure_code: string | null;
  run_id: string | null;
  has_outputs: boolean;
  has_draft: boolean;
  can_manage: boolean;
  allow_recording_upload: boolean;
  allow_transcript_upload: boolean;
};

export type ConsentRequestsOut = { status: CaptureStatusOut; sent: string[] };
export type UploadOut = { status: CaptureStatusOut; transcript_id: string | null; needs_transcript: boolean };
export type RecordingAckOut = { acked: boolean; acked_at: string | null; statement: string; statement_version: string };

export type EvidenceQuote = { segment_seq: number; start_ms: number | null; quote: string };
export type CompetencySummary = { competency_key: string; label: string; summary: string; evidence: EvidenceQuote[] };
export type QaItem = {
  asked_text: string;
  kit_question_key: string | null;
  kit_question_text: string | null;
  match_confidence: number | null;
  response_quote: string;
  segment_seqs: number[];
  start_ms: number | null;
};
export type OutputsOut = {
  capture_id: string;
  interview_id: string;
  candidate_id: string;
  status: string;
  summary_by_competency: CompetencySummary[];
  qa_items: QaItem[];
  overall_summary: string | null;
  ai_generated: boolean;
  skill_suggestion_count: number;
  created_at: string;
};

export type DraftRating = { competency_key: string; label: string | null; suggested_rating: number; rationale: string; evidence: EvidenceQuote[] };
export type DraftOut = {
  id: string;
  interview_id: string;
  participant_id: string;
  ratings: DraftRating[];
  answers: { question_key: string; note_suggestion: string }[];
  recommendation: null;
  status: "ready" | "opened" | "applied" | "dismissed" | "superseded";
  rating_scale: number;
  show_suggestions_by_default: boolean;
  opened_at: string | null;
  ai_generated: boolean;
};

export type AssistantSettings = {
  show_suggestions_by_default: boolean;
  allow_recording_upload: boolean;
  allow_transcript_upload: boolean;
  consent_link_days: number;
  max_upload_mb: number;
};

export type RerunOut = { run_id: string | null; status: string; reason: string | null };

export type RecordingConsentView = {
  tenant_name: string | null;
  candidate_first_name: string | null;
  stage_name: string | null;
  starts_at: string | null;
  status: ConsentState;
  notice_title: string;
  notice_body: string;
  country: string | null;
  region: string | null;
};

export type CaptureAckView = {
  tenant_name: string | null;
  participant_name: string | null;
  stage_name: string | null;
  starts_at: string | null;
  statement: string;
  status: "agreed" | "waiting";
};
