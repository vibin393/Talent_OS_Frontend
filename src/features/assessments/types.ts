// Epic 40 (Assessments): hand-written API types (prefix /api/v1). Decimals are JSON strings; datetimes ISO strings.
// Kept independent of the generated schema so the feature builds before `gen:api` picks up the new routers.

export type ItemKind =
  | "single"
  | "multi"
  | "true_false"
  | "numeric"
  | "short_text"
  | "code_output"
  | "code_fill"
  | "code_order"
  | "code_find_bug"
  | "code_freeform"
  | "essay";

export type Choice = { id: string; text: string };
export type CodeLine = { id: string; text: string };

/** `options` per kind: choices (single/multi/true_false), lines (code_order), otherwise `{}`. */
export type ItemOptions = { choices?: Choice[]; lines?: CodeLine[] };

export type ShortTextNormalise = { case: boolean; whitespace: boolean; punctuation: boolean };
export type CodeOutputNormalise = { trailing_ws: boolean; blank_lines: boolean; case: boolean };
export type KeywordWeight = { term: string; weight: string };

export type AnswerKey =
  | { correct: string } // single / true_false
  | { correct: string[] } // multi
  | { value: string; tolerance_abs?: string | null; tolerance_pct?: string | null } // numeric
  | {
      accepted: string[];
      normalise: ShortTextNormalise;
      keywords?: KeywordWeight[];
      min_keyword_score?: string | null;
    } // short_text
  | { accepted: string[]; normalise: CodeOutputNormalise; regex?: string | null } // code_output
  | { blanks: Record<string, { accepted: string[]; normalise: { token_ws: boolean } }> } // code_fill
  | { order: string[]; partial: "lcs" | "none" } // code_order
  | { bug_lines: number[]; penalise_wrong: boolean }; // code_find_bug

export type RubricCriterion = { key: string; label: string; max_points: string; guidance: string };
export type Rubric = { criteria: RubricCriterion[] };

export type ItemVersionOut = {
  id: string;
  version: number;
  stem: string;
  language: string | null;
  code: string | null;
  options: ItemOptions;
  points: string;
  answer_key: AnswerKey | null;
  rubric: Rubric | null;
  created_at: string;
};

export type ItemOut = {
  id: string;
  human_id: string;
  kind: ItemKind;
  skill_keys: string[];
  tags: string[];
  difficulty: number;
  current_version: number;
  archived_at: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
  version: ItemVersionOut;
};

export type ItemUpdate = {
  skill_keys: string[];
  tags: string[];
  difficulty: number;
  stem: string;
  language?: string | null;
  code?: string | null;
  options: ItemOptions;
  points: string;
  answer_key: AnswerKey | null;
  rubric: Rubric | null;
};
export type ItemCreate = ItemUpdate & { kind: ItemKind };

export type ImportRow = { row: number; kind: string | null; stem: string | null; errors: string[]; valid: boolean };
export type ImportPreviewOut = { batch_id: string; rows: ImportRow[]; valid_count: number; error_count: number };
export type ImportCommitOut = { created: number; item_ids: string[] };

// ---------------------------------------------------------------- assessments

export type AssessmentStatus = "draft" | "published" | "archived";
export type Delivery = "builtin" | "provider";

export type DraftSectionItem = { item_id: string; points?: string | null };
export type DrawRule = { skill_keys?: string[]; tags?: string[]; difficulty: [number, number]; count: number };
export type DraftSection = {
  key: string;
  title: string;
  time_limit_minutes?: number | null;
  items?: DraftSectionItem[];
  draw?: DrawRule;
};

export type VersionSectionOut = {
  key: string;
  title: string;
  time_limit_minutes: number | null;
  kind: "fixed" | "draw";
  item_count: number;
  points: string;
  pool_size: number | null;
};

export type VersionOut = {
  id: string;
  version: number;
  published_at: string;
  published_by: string | null;
  total_points: string;
  sections: VersionSectionOut[];
};

export type AssessmentOut = {
  id: string;
  name: string;
  description: string | null;
  status: AssessmentStatus;
  delivery: Delivery;
  owner_id: string | null;
  time_limit_minutes: number | null;
  pass_mark_pct: string | null;
  gating_default: boolean;
  current_version_id: string | null;
  current_version_no: number | null;
  updated_at: string;
  created_at: string;
};

export type AssessmentDetailOut = AssessmentOut & {
  instructions: string | null;
  shuffle_items: boolean;
  shuffle_options: boolean;
  attempts_limit: number;
  auto_pass_threshold_pct: string | null;
  skill_keys: string[];
  provider_config_id: string | null;
  provider_test_ref: string | null;
  draft_sections: DraftSection[];
  current_version: VersionOut | null;
  versions: { id: string; version: number; published_at: string; total_points: string }[];
};

export type AssessmentSettingsIn = {
  name: string;
  description?: string | null;
  instructions?: string | null;
  delivery: Delivery;
  time_limit_minutes?: number | null;
  pass_mark_pct?: string | null;
  shuffle_items: boolean;
  shuffle_options: boolean;
  attempts_limit: number;
  gating_default: boolean;
  auto_pass_threshold_pct?: string | null;
  skill_keys: string[];
  provider_config_id?: string | null;
  provider_test_ref?: string | null;
};

export type PublishOut = { version: VersionOut; warnings: string[] };

export type ProviderTestOut = {
  id: string;
  config_id: string;
  external_ref: string;
  name: string;
  duration_minutes: number | null;
  skills: string[];
  synced_at: string;
};

export type AssessmentTenantSettings = {
  allow_auto_pass_non_gating: boolean;
  short_answer_confidence_threshold: string;
  reminder_hours_before: number;
  default_deadline_days: number;
  link_grace_days: number;
  max_signals_per_minute: number;
  max_signals_per_attempt: number;
  multi_choice_partial_credit: boolean;
};

// ---------------------------------------------------------------- invitations

export type ContextKind = "application" | "campus_drive" | "event" | "direct";
export type InvitationStatus = "invited" | "started" | "expired" | "completed" | "reviewed" | "passed" | "failed" | "cancelled";

export type InvitationCreate = {
  assessment_id: string;
  candidate_id: string;
  context_kind: ContextKind;
  context_id?: string | null;
  application_id?: string | null;
  gating?: boolean | null;
  deadline_at?: string | null;
  accommodation_factor?: string;
  send_notice?: boolean;
  idempotency_key?: string | null;
};

export type BulkInviteIn = {
  candidate_ids?: string[];
  application_ids?: string[];
  pool_id?: string;
  deadline_at?: string | null;
  gating?: boolean | null;
  accommodation_factor?: string;
  screen_reader_mode?: boolean;
};

export type BulkInviteResult = {
  candidate_id: string;
  application_id: string | null;
  status: "created" | "exists" | "error";
  invitation_id: string | null;
  error_code: string | null;
};
export type BulkInviteOut = { results: BulkInviteResult[] };

export type SectionScore = { title: string; pct: string; points: string; max_points: string };
export type SkillScore = { pct: string; proficiency: number | null; label: string | null };

export type InvitationOut = {
  id: string;
  assessment_id: string;
  assessment_name: string;
  delivery: Delivery;
  candidate_id: string;
  candidate_name: string | null;
  application_id: string | null;
  context_kind: ContextKind;
  context_id: string | null;
  status: InvitationStatus;
  gating: boolean;
  result: string | null;
  score: string | null;
  scored_at: string | null;
  deadline_at: string | null;
  percentile: string | number | null;
  points: string | null;
  max_points: string | null;
  section_scores: Record<string, SectionScore>;
  skill_scores: Record<string, SkillScore>;
  accommodation_factor: string;
  screen_reader_mode: boolean;
  extended_count: number;
  report_url: string | null;
  report_file_id: string | null;
  provider_ref: string | null;
  decided_at: string | null;
  decision_note: string | null;
  cancel_reason: string | null;
  created_at: string;
  attempt_id: string | null;
  signal_counts: Record<string, number>;
  pending_reviews: number;
  /** Epic 49: set when NYC LL144 hides the score (score / percentile / points are then null). */
  score_hidden_reason?: "alternative_process" | "notice_period" | null;
};

export type ManualResultIn = {
  score_pct: string;
  result_note?: string | null;
  report_file_id?: string | null;
  skill_scores: { skill_key: string; proficiency: number }[];
};

export type AssessmentBadge = {
  application_id: string;
  invitation_id: string;
  status: InvitationStatus;
  score: string | null;
  result: string | null;
};
export type AssessmentBadgesOut = { items: AssessmentBadge[] };

// ---------------------------------------------------------------- review and proctoring

export type ReviewItemOut = {
  answer_id: string;
  attempt_id: string;
  invitation_id: string;
  assessment_name: string;
  candidate_name: string | null;
  position: number;
  section_key: string;
  kind: ItemKind;
  stem: string;
  code: string | null;
  language: string | null;
  response: unknown;
  max_points: string;
  auto_score: string | null;
  auto_confidence: string | null;
  needs_review: boolean;
  final_score: string | null;
  scored_via: string | null;
  rubric: Rubric | null;
  reviews: { reviewer_id: string; score: string; note: string | null; created_at: string }[];
};

export type ReviewIn = { score: string; rubric_marks?: Record<string, string>; note?: string | null };
export type AiSuggestionOut = { suggested_score: string; rationale: string; advisory: true; ai_action_id: string | null };

export type SignalKind = "tab_switch" | "focus_loss" | "copy" | "paste" | "fullscreen_exit" | "concurrent_session" | "ip_change";
/** Kinds the candidate client is allowed to send. */
export type ClientSignalKind = "tab_switch" | "focus_loss" | "copy" | "paste" | "fullscreen_exit";

export type SignalAnnotation = { id: string; signal_id: string | null; note: string; created_by: string | null; created_at: string };
export type SignalsOut = {
  counts: Record<string, number>;
  dropped: number;
  timeline: { id: string; kind: SignalKind; occurred_at: string; client_ts: string | null; detail: Record<string, unknown> | null }[];
  annotations: SignalAnnotation[];
};

export type SubmissionSharesOut = { invitation_ids: string[] };

// ---------------------------------------------------------------- candidate taking (delivery types: never any key fields)

export type PortalAssessmentOut = { invitation_id: string; assessment_name: string; status: InvitationStatus; deadline_at: string | null };

export type PreStartOut = {
  invitation_id: string;
  assessment_name: string;
  instructions: string | null;
  status: InvitationStatus;
  deadline_at: string | null;
  time_limit_minutes: number | null;
  accommodation_factor: string;
  screen_reader_mode: boolean;
  sections: { key: string; title: string; item_count: number; time_limit_minutes: number | null }[];
  notice: { notice_id: string | null; title: string; body_md: string };
  logged_signals: string[];
  has_active_attempt: boolean;
  delivery: Delivery;
  take_url: string | null;
};

export type DeliveryItem = {
  position: number;
  section_key: string;
  kind: ItemKind;
  stem: string;
  options: Choice[] | null;
  code: string | null;
  language: string | null;
  lines: CodeLine[] | null;
  blanks: number | null;
  points: string;
};

export type AttemptStatus = "in_progress" | "submitted" | "auto_submitted";

export type AttemptView = {
  session_id: string | null;
  server_now: string;
  deadline_at: string;
  remaining_seconds: number;
  status: AttemptStatus;
  current_section: string | null;
  screen_reader_mode: boolean;
  sections: { key: string; title: string; deadline_at: string | null; closed: boolean; positions: number[] }[];
  items: DeliveryItem[];
  /** The candidate's own saved responses keyed by position (shapes in `CandidateResponse`). */
  answers: Record<string, unknown>;
};

export type AutosaveIn = { client_seq: number; answers: { position: number; response: unknown }[] };
export type AutosaveOut = { saved: number; server_now: string; deadline_at: string; remaining_seconds: number };
export type SignalIn = { kind: ClientSignalKind; client_ts?: string | null; detail?: Record<string, unknown> | null };
export type SignalsBatchOut = { accepted: number; dropped: number };
export type SubmitOut = { status: "submitted" | "auto_submitted"; submitted_at: string };

/** Response shapes the candidate client sends per kind. */
export type CandidateResponse =
  | { choice: string }
  | { choices: string[] }
  | { value: string }
  | { text: string }
  | { blanks: Record<string, string> }
  | { order: string[] }
  | { lines: number[] };
