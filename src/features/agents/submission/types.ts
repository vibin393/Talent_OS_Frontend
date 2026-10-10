/** Epic 61 Submission Agent DTOs (hand-mirrored from `app/schemas/submission_packs.py`). */

export type CheckKey = "consent" | "margin" | "rate_card" | "duplicate" | "vendor_ownership" | "required_fields" | "resume_format";
export type CheckLevel = "pass" | "warn" | "block" | "needs_input" | "unavailable";
export type PackStatus = "draft" | "ready" | "blocked";
export type PackLifecycle = "open" | "used" | "discarded" | "stale";
export type WriteUpStatus = "pending" | "drafted" | "failed" | "edited";
export type PackRateUnit = "hour" | "day" | "month" | "year";
export type PackResumeKind = "original" | "client_formatted";
export type ResumeFormat = "either" | "original" | "client_formatted";

export interface PackLink {
  kind: string;
  id: string | null;
  path: string | null;
}

export interface PackCheckDetail {
  key: CheckKey;
  level: CheckLevel;
  code: string;
  message: string;
  details: Record<string, unknown>;
  link: PackLink | null;
}

export interface PackRatesIn {
  pay_rate?: string | null;
  bill_rate?: string | null;
  pay_rate_unit?: PackRateUnit | null;
  bill_rate_unit?: PackRateUnit | null;
  currency?: string | null;
}

export interface PackUserChanges {
  changed_fields: string[];
  note_change: "unchanged" | "edited" | "replaced";
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export interface PackDetailOut {
  id: string;
  human_id: string;
  application_id: string;
  candidate_id: string;
  candidate_name: string | null;
  demand_id: string;
  demand_title: string | null;
  client_id: string;
  client_name: string | null;
  status: PackStatus;
  lifecycle: PackLifecycle;
  version: number;
  resume_kind: PackResumeKind | null;
  resume_id: string | null;
  resume_version: number | null;
  resume_uploaded_at: string | null;
  resume_stale: boolean;
  document_ids: string[];
  summary_text: string | null;
  write_up_status: WriteUpStatus;
  word_count: number;
  max_words: number;
  pay_rate: string | null;
  bill_rate: string | null;
  currency: string | null;
  pay_rate_unit: PackRateUnit | null;
  bill_rate_unit: PackRateUnit | null;
  rates_hidden: boolean;
  email_subject: string | null;
  checks: PackCheckDetail[];
  missing: string[];
  blocker_count: number;
  warning_count: number;
  checked_at: string | null;
  consent_request_sent_at: string | null;
  prepared_by_kind: "agent" | "user" | "system";
  prepared_by_id: string | null;
  agent_run_id: string | null;
  opened_in_dialog_at: string | null;
  submission_id: string | null;
  submission_human_id: string | null;
  used_at: string | null;
  user_changes: PackUserChanges | null;
  discarded_reason: string | null;
  lock_version: number;
  created_at: string;
  updated_at: string;
}

export interface PackSummaryOut {
  id: string;
  human_id: string;
  application_id: string;
  candidate_id: string;
  candidate_name: string | null;
  demand_id: string;
  demand_title: string | null;
  client_id: string;
  client_name: string | null;
  status: PackStatus;
  lifecycle: PackLifecycle;
  blocker_count: number;
  warning_count: number;
  prepared_by_kind: string;
  owner_id: string | null;
  owner_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface PackPage {
  items: PackSummaryOut[];
  total: number;
  page: number;
  page_size: number;
}

export interface PackPatchIn {
  summary_text?: string | null;
  rates?: PackRatesIn | null;
  email_subject?: string | null;
  lock_version: number;
}

export interface PackMetricsOut {
  period_from: string;
  period_to: string;
  submissions_with_pack: number;
  submissions_without_pack: number;
  median_hours_with_pack: number | null;
  median_hours_without_pack: number | null;
  packs_used: number;
  packs_low_change: number;
  pct_low_change: number | null;
  open_packs: number;
  blocked_packs: number;
}

export interface PackAgentStatusOut {
  enabled: boolean;
  paused: boolean;
}

export interface ClientSubmissionRulesIn {
  resume_format: ResumeFormat;
  mask_contact_details: boolean;
  write_up_max_words: number;
  write_up_instructions: string | null;
  duplicate_window_days: number | null;
  require_candidate_consent: boolean;
  show_notice_period: boolean;
}

export interface ClientSubmissionRulesOut extends ClientSubmissionRulesIn {
  client_id: string;
  is_default: boolean;
  tenant_duplicate_window_days: number;
  tenant_consent_mode: string;
  updated_by: string | null;
  updated_at: string | null;
}

/** Foundation `RunRef` (`POST /agent-runs`). */
export interface RunRef {
  run_id: string | null;
  status: string;
  reason: string | null;
}
