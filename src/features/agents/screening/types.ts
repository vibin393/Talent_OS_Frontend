/**
 * Epic 57 (Screening Agent) API types, mirroring `app/schemas/screening_agent.py` ("Epic 57 additions",
 * `StartOptionsOut`) and `app/schemas/screening_chat_portal.py` exactly. Hand-written like `lib/api/agentic-types.ts`
 * (`npm run gen:api` is not run during Phase 4). Pydantic serialises `Decimal` as a string, so confidence and the
 * threshold arrive as strings; the helpers in `logic.ts` accept both.
 */

export type AnswerType = "text" | "number" | "boolean" | "choice" | "money" | "date" | "rating";
export type Unit = "days" | "weeks" | "months" | "years" | "hours" | "km" | "lpa" | "percent";
export type QuestionOrigin = "default" | "skill" | "manual" | "ai_generated";
export type KnockoutOp = "lt" | "lte" | "gt" | "gte" | "eq" | "neq" | "in" | "not_in";
export type ScreeningChannel = "portal_chat" | "link_chat" | "email" | "whatsapp";
export type StartChannel = "auto" | ScreeningChannel;
export type ConversationStatus =
  | "invited"
  | "consented"
  | "in_progress"
  | "paused"
  | "completed"
  | "reviewed"
  | "expired"
  | "withdrawn"
  | "handed_off"
  | "taken_over"
  | "consent_refused"
  | "cancelled";
export type AnswerStatus = "unconfirmed" | "accepted" | "edited" | "rejected";
export type DecimalValue = string | number;

export type MappedField = string;

export interface KnockoutRule {
  op: KnockoutOp;
  value: unknown;
}

/** A question as an editor submits it (`id` optional: new questions get a stable id). */
export interface QuestionDraft {
  id?: string | null;
  key: string;
  label: string;
  type: AnswerType;
  unit?: Unit | null;
  currency?: string | null;
  options?: string[] | null;
  required?: boolean;
  maps_to?: MappedField | null;
  min?: number | null;
  max?: number | null;
  knockout?: KnockoutRule | null;
  origin?: QuestionOrigin;
  accepted_by?: string | null;
}

export interface AgentQuestion extends QuestionDraft {
  id: string;
  unit: Unit | null;
  currency: string | null;
  options: string[] | null;
  required: boolean;
  maps_to: MappedField | null;
  min: number | null;
  max: number | null;
  knockout: KnockoutRule | null;
  origin: QuestionOrigin;
  accepted_by: string | null;
}

export type Clarifications = Record<string, Record<string, string>>;

export interface VersionCreate {
  questions?: QuestionDraft[] | null;
  clarifications?: Clarifications | null;
  change_note?: string | null;
}
export type VersionUpdate = VersionCreate;

export interface VersionOut {
  id: string;
  questionnaire_id: string;
  questionnaire_name?: string | null;
  version: number;
  status: "draft" | "approved" | "retired";
  questions: AgentQuestion[];
  clarifications: Clarifications;
  approved_by: string | null;
  approved_at: string | null;
  change_note: string | null;
  created_at: string;
}

export interface GeneratedQuestionsOut {
  questions: AgentQuestion[];
}

export type BindingScope = "tenant" | "client" | "demand";

export interface BindingIn {
  scope_kind: BindingScope;
  scope_id?: string | null;
}

export interface BindingOut {
  id: string;
  questionnaire_id: string;
  scope_kind: BindingScope | string;
  scope_id: string | null;
}

// ---------------------------------------------------------------- conversations
export interface TurnOut {
  id: string;
  seq: number;
  direction: "inbound" | "outbound";
  author: "agent" | "candidate" | "recruiter" | "system";
  kind: string;
  channel: string;
  body: string;
  question_ids: string[];
  citations: string[];
  template_key: string | null;
  created_at: string;
}

export interface ConversationOut {
  id: string;
  human_id: string;
  application_id: string;
  candidate_id: string;
  demand_id: string;
  screening_id: string | null;
  questionnaire_version_id: string;
  questionnaire_label?: string | null;
  channel: ScreeningChannel;
  status: ConversationStatus;
  current_run_id: string | null;
  owner_user_id: string;
  owner_name?: string | null;
  invited_at: string | null;
  consented_at: string | null;
  completed_at: string | null;
  expires_at: string;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  wa_window_open: boolean;
  reminders_sent: number;
  handoff_reason: string | null;
  taken_over_by: string | null;
  required_count: number;
  answered_count: number;
  summary: string | null;
  gaps: unknown[];
  flags: unknown[];
  created_at: string;
}

export interface ConversationDetailOut extends ConversationOut {
  turns: TurnOut[];
}

export interface ChannelOption {
  channel: ScreeningChannel;
  available: boolean;
  reason?: string | null;
}

export interface StartOptionsOut {
  channels: ChannelOption[];
  best_channel: ScreeningChannel | null;
  questionnaire_id: string | null;
  questionnaire_name: string | null;
  version_id: string | null;
  version: number | null;
  blocked_reason?: string | null;
}

// ---------------------------------------------------------------- review
export interface AnswerOut {
  id: string;
  question_id: string;
  question_label: string;
  question_type: string;
  unit?: string | null;
  required: boolean;
  source: "text" | "voice";
  answer_text: string | null;
  normalized: Record<string, unknown> | null;
  confidence: DecimalValue | null;
  low_confidence: boolean;
  flags: string[];
  knockout?: KnockoutRule | null;
  status: AnswerStatus;
  edited_value: Record<string, unknown> | null;
  segment_refs: number[];
  start_ms: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface ReviewOut {
  conversation_id: string | null;
  voice_session_id: string | null;
  application_id: string;
  screening_id: string | null;
  status: string;
  threshold: DecimalValue;
  summary: string | null;
  gaps: unknown[];
  suggested_next: string | null;
  unanswered_required: string[];
  answers: AnswerOut[];
  can_complete: boolean;
}

export interface AnswerDecisionIn {
  decision: "accept" | "edit" | "reject";
  edited_value?: Record<string, unknown> | null;
}

/** Exactly one of the two ids. */
export type ReviewTarget = { conversationId: string; voiceSessionId?: undefined } | { voiceSessionId: string; conversationId?: undefined };

// ---------------------------------------------------------------- settings
export interface ScreeningAgentSettingsOut {
  expiry_days: number;
  reminder_after_hours: number;
  max_reminders: number;
  questions_per_turn: number;
  low_confidence_threshold: DecimalValue;
  stop_words: string[];
  whatsapp_invite_template_id: string | null;
  default_channel: StartChannel;
  allow_campus_candidates: boolean;
}

export type ScreeningAgentSettingsIn = Partial<{
  expiry_days: number;
  reminder_after_hours: number;
  max_reminders: number;
  questions_per_turn: number;
  low_confidence_threshold: string;
  stop_words: string[];
  whatsapp_invite_template_id: string | null;
  default_channel: StartChannel;
  allow_campus_candidates: boolean;
}>;

// ---------------------------------------------------------------- candidate-facing chat (portal + secure link)
export type CandidateChatStatus = "waiting_for_consent" | "open" | "paused" | "ended";

export interface PortalChatTurn {
  seq: number;
  author: "assistant" | "you" | "recruiter";
  body: string;
  sent_at: string;
}

export interface PortalChatNotice {
  notice_id: string | null;
  title: string;
  body_md: string;
}

export interface PortalScreeningChat {
  id: string;
  title: string;
  status: CandidateChatStatus;
  recruiter_name: string;
  consent_needed: boolean;
  can_reply: boolean;
  notice?: PortalChatNotice | null;
  turns: PortalChatTurn[];
}

export interface PortalScreeningChatSummary {
  id: string;
  title: string;
  status: CandidateChatStatus;
  recruiter_name: string;
  last_message_at: string | null;
}

export interface ChatConsentIn {
  decision: "agree" | "decline";
  notice_id?: string | null;
}
