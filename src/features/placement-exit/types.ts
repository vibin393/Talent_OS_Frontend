/**
 * Epic 31 (Extension, Conversion & Offboarding) wire types — hand-written from
 * `Backend/app/schemas/placements_exit.py` and `placements_exit_portal.py`.
 * Decimals arrive as strings; compensation fields are `null` when masked (no `compensation:view`).
 */

export type ExtensionStatus =
  | "proposed"
  | "pending_approval"
  | "pending_client_confirmation"
  | "confirmed"
  | "declined"
  | "withdrawn";
export type CaseReason = "end_of_term" | "client_termination" | "worker_resignation" | "converted" | "misconduct" | "other";
export type CaseStatus = "initiated" | "in_progress" | "ready_to_close" | "closed" | "cancelled";
export type ItemStatus = "pending" | "done" | "waived" | "not_applicable";
export type OwnerRole = "account_manager" | "recruiter" | "hr" | "finance" | "payroll";
export type CheckStatus = "pass" | "warn" | "fail";
export type RateUnit = "hour" | "day" | "month" | "fixed";

// ---------------------------------------------------------------- settings / templates
export type ExitSettingsOut = {
  alert_offsets_days: number[];
  notify_client_users: boolean;
  bench_excluded_reasons: string[];
  early_attrition_days: number;
  auto_case_grace_days: number;
};

export type ExitSettingsUpdate = Partial<{
  alert_offsets_days: number[];
  notify_client_users: boolean;
  bench_excluded_reasons: CaseReason[];
  early_attrition_days: number;
  auto_case_grace_days: number;
}>;

export type TemplateItem = {
  kind: string;
  label: string;
  mandatory: boolean;
  owner_role: OwnerRole;
  due_offset_days: number;
  verifier?: string | null;
};

export type TemplateOut = { id: string; name: string; is_default: boolean; items: TemplateItem[]; updated_at: string };
export type TemplateIn = { name: string; is_default: boolean; items: TemplateItem[] };
export type TemplateUpdate = Partial<TemplateIn>;

// ---------------------------------------------------------------- ending soon
export type EndingSoonRow = {
  placement_id: string;
  human_id: string;
  candidate_id: string;
  candidate_name: string | null;
  client_id: string;
  client_name: string | null;
  role_title: string | null;
  worker_type: string | null;
  end_date: string;
  days_left: number;
  open_extension_id: string | null;
  open_case_id: string | null;
};

// ---------------------------------------------------------------- extensions
export type CheckResult = {
  name: string;
  status: CheckStatus;
  details: Record<string, unknown>;
  overridable: boolean;
};

export type ExtensionIn = {
  new_end_date: string;
  segment_effective_from?: string | null;
  rate_unit?: RateUnit | null;
  pay_rate?: string | null;
  bill_rate?: string | null;
  vendor_rate?: string | null;
  burden_pct?: string | null;
  po_id?: string | null;
  note?: string | null;
};

export type ExtensionPreviewOut = {
  checks: CheckResult[];
  margin_amount: string | null;
  margin_pct: string | null;
  blocking: boolean;
};

export type ExtensionOut = {
  id: string;
  human_id: string;
  placement_id: string;
  current_end_date: string;
  new_end_date: string;
  segment_effective_from: string | null;
  rate_unit: string | null;
  pay_rate: string | null;
  bill_rate: string | null;
  vendor_rate: string | null;
  burden_pct: string | null;
  currency: string | null;
  po_id: string | null;
  status: ExtensionStatus;
  checks: CheckResult[];
  approval_request_id: string | null;
  exception_approval_request_id: string | null;
  exception_status: string;
  client_response_by_kind: string | null;
  client_response_at: string | null;
  client_evidence_file_id: string | null;
  client_comment: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  rate_segment_id: string | null;
  withdraw_reason: string | null;
  extension_letter_document_id: string | null;
  send_extension_letter: boolean;
  note: string | null;
  created_at: string;
};

export type RecordedResponseIn = {
  decision: "confirm" | "decline";
  evidence_file_id: string;
  comment?: string | null;
  send_extension_letter?: boolean;
};

export type LinkOut = { url: string; expires_at: string };

// ---------------------------------------------------------------- conversion
export type ConversionIn = {
  conversion_date: string;
  offered_compensation: string;
  currency?: string | null;
  note?: string | null;
};
export type FeePreviewIn = { offered_compensation: string; conversion_date?: string | null };
export type FeePreviewOut = { fee_rule: Record<string, unknown>; fee_proposal: string | null; currency: string };
export type ConversionOut = {
  id: string;
  placement_id: string;
  conversion_date: string;
  offered_compensation: string | null;
  currency: string;
  fee_rule_snapshot: Record<string, unknown>;
  fee_proposal: string | null;
  offboarding_case_id: string | null;
  created_at: string;
};

// ---------------------------------------------------------------- offboarding
export type OffboardingStartIn = {
  reason: CaseReason;
  last_working_day: string;
  notice_date?: string | null;
  reason_note?: string | null;
  template_id?: string | null;
};

export type EarlyTerminationIn = {
  initiated_by: "client" | "worker";
  notice_date: string;
  requested_lwd: string;
  reason?: string | null;
  template_id?: string | null;
};

export type OffboardingItemOut = {
  id: string;
  case_id: string;
  position: number;
  kind: string;
  label: string;
  mandatory: boolean;
  owner_role: string | null;
  owner_id: string | null;
  owner_name: string | null;
  due_date: string | null;
  task_id: string | null;
  verifier: string | null;
  status: ItemStatus;
  waived_reason: string | null;
  completed_by_kind: string | null;
  completed_at: string | null;
  evidence_file_id: string | null;
  document_id: string | null;
  note: string | null;
  auto_verified: boolean;
  verifier_details: Record<string, unknown> | null;
};

export type OffboardingCaseOut = {
  id: string;
  human_id: string;
  placement_id: string;
  placement_human_id: string | null;
  candidate_name: string | null;
  client_name: string | null;
  worker_type: string | null;
  reason: CaseReason;
  reason_note: string | null;
  notice_date: string | null;
  requested_lwd: string | null;
  last_working_day: string;
  previous_end_date: string | null;
  notice_period_days_snapshot: number | null;
  notice_shortfall_days: number | null;
  early_termination_by: string | null;
  early_attrition: boolean;
  bench_eligible: boolean | null;
  status: CaseStatus;
  initiated_by_kind: string;
  client_confirmed_at: string | null;
  closed_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  items_total: number;
  items_open: number;
};

export type FeedbackOut = { answers: Record<string, unknown>; recorded_by_kind: string; created_at: string };

export type SettlementLine = {
  kind: string;
  label: string;
  status: ItemStatus;
  auto_verified: boolean;
  details: Record<string, unknown> | null;
  link: string | null;
};

export type OffboardingCaseDetail = OffboardingCaseOut & {
  items: OffboardingItemOut[];
  feedback: FeedbackOut | null;
  settlement: SettlementLine[];
  conversion: ConversionOut | null;
};

export type ItemCompleteIn = { evidence_file_id?: string | null; document_id?: string | null; note?: string | null };

// ---------------------------------------------------------------- client portal / secure link
export type ClientExtensionSummary = {
  id: string;
  human_id: string;
  placement_id: string;
  placement_human_id: string;
  worker_name: string | null;
  role_title: string | null;
  current_end_date: string;
  new_end_date: string;
  status: string;
  client_response_at: string | null;
  client_comment: string | null;
};

export type ClientOffboardingSummary = {
  id: string;
  human_id: string;
  placement_id: string;
  placement_human_id: string;
  worker_name: string | null;
  role_title: string | null;
  reason: string;
  last_working_day: string;
  status: string;
  client_confirmed_at: string | null;
};

export type ExtensionRespondIn = { decision: "confirm" | "decline"; comment?: string | null };
export type OffboardingConfirmIn = { last_working_day_ack: boolean; comment?: string | null };

export type PublicExtensionView = {
  tenant_name: string | null;
  worker_name: string | null;
  role_title: string | null;
  current_end_date: string;
  new_end_date: string;
  status: string;
  expires_at: string;
};

export type PublicOffboardingView = {
  tenant_name: string | null;
  worker_name: string | null;
  role_title: string | null;
  last_working_day: string;
  status: string;
  client_confirmed: boolean;
  expires_at: string;
};

export type PublicActionResult = { status: string };

/** Minimal attachment response (generic `/{entity}/{id}/attachments` upload). */
export type UploadedAttachment = { id: string; file: { id: string; original_name: string } };
