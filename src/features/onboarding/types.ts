/** Hand-written aliases of the Epic 23 onboarding API (`app/schemas/onboarding.py`). */

export type TaskKind =
  | "personal_details"
  | "bank_details"
  | "tax_details"
  | "emergency_contact"
  | "document_upload"
  | "esign"
  | "policy_ack"
  | "client_form"
  | "credential"
  | "internal";
export type OwnerKind = "role" | "placement_account_manager" | "placement_recruiter" | "case_owner";
export type CaseStatus = "not_started" | "in_progress" | "complete" | "cancelled";
export type TaskStatus = "pending" | "submitted" | "returned" | "approved" | "waived";

export type OnboardingSettings = {
  auto_invite: boolean;
  worker_reminder_every_days: number;
  default_owner_by_role: Record<string, string | null>;
  default_hr_owner_id: string | null;
  default_tenant_signatory_user_id: string | null;
  reuse_validity_days: number;
};

export type TemplateTask = {
  id?: string;
  key: string;
  kind: TaskKind;
  label: string;
  instructions: string | null;
  mandatory: boolean;
  assignee?: "worker" | "user";
  owner_kind: OwnerKind | null;
  owner_role_key: string | null;
  due_offset_days: number;
  auto_approve: boolean;
  reusable: boolean;
  validity_days: number | null;
  config: Record<string, unknown>;
  position?: number;
};

export type OnboardingTemplate = {
  id: string;
  name: string;
  legal_entity_id: string | null;
  client_id: string | null;
  worker_type: string | null;
  country: string | null;
  active: boolean;
  archived_at: string | null;
  version: number;
  tasks: TemplateTask[];
};

export type TemplateIn = {
  name: string;
  legal_entity_id: string | null;
  client_id: string | null;
  worker_type: string | null;
  country: string | null;
  active: boolean;
  tasks: TemplateTask[];
};

export type OnboardingTask = {
  id: string;
  case_id: string;
  key: string;
  position: number;
  kind: TaskKind;
  label: string;
  instructions: string | null;
  mandatory: boolean;
  assignee: "worker" | "user";
  owner_user_id: string | null;
  p1_task_id: string | null;
  due_on: string | null;
  source: "template" | "compliance" | "user";
  status: TaskStatus;
  submitted_at: string | null;
  auto_approve: boolean;
  config: Record<string, unknown>;
  data: Record<string, unknown> | null;
  document_ids: string[];
  signature_request_id: string | null;
  credential_id: string | null;
  return_comment: string | null;
  waived_reason: string | null;
  decided_by_kind: "user" | "system" | null;
  decided_by_id: string | null;
  decided_at: string | null;
  reused_from_task_id: string | null;
  overdue: boolean;
};

export type OnboardingCase = {
  id: string;
  human_id: string | null;
  placement_id: string;
  placement_human_id: string | null;
  candidate_id: string;
  worker_name: string | null;
  client_id: string | null;
  client_name: string | null;
  planned_start_date: string | null;
  template_id: string | null;
  template_name: string | null;
  status: CaseStatus;
  owner_user_id: string | null;
  invited_at: string | null;
  progress_pct: number;
  completed_at: string | null;
  cancelled_reason: string | null;
  gate_status: string | null;
  bank_last4: string | null;
  pan_last4: string | null;
  tasks: OnboardingTask[];
};

export type BoardRow = {
  id: string;
  human_id: string | null;
  placement_id: string;
  placement_human_id: string | null;
  candidate_id: string;
  worker_name: string | null;
  client_id: string | null;
  client_name: string | null;
  planned_start_date: string | null;
  status: CaseStatus;
  owner_user_id: string | null;
  progress_pct: number;
  counts: Partial<Record<TaskStatus, number>>;
  overdue: number;
  oldest_submitted_days: number | null;
};

export type UnmatchedPlacement = {
  placement_id: string;
  human_id: string;
  candidate_id: string;
  client_id: string;
  planned_start_date: string;
};

export type BulkResult = { approved: string[]; failed: Record<string, string> };
