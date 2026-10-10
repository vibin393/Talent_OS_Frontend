/** Epic 20 BGV DTOs (hand-written aliases of `app/schemas/bgv.py` / `bgv_portal.py`). */

export type CheckType =
  | "identity"
  | "employment"
  | "education"
  | "address"
  | "reference"
  | "professional_licence"
  | "criminal_record"
  | "drug_test";

export type CaseStatus =
  | "initiated"
  | "documents_pending"
  | "in_verification"
  | "discrepancy"
  | "under_review"
  | "clear"
  | "failed"
  | "cancelled";

export type CheckStatus = "pending" | "in_progress" | "verified" | "discrepancy" | "unable_to_verify" | "waived";
export type CheckResult = "verified" | "discrepancy" | "unable_to_verify";
export type Severity = "minor" | "major" | "critical";
export type DiscrepancyStatus = "awaiting_response" | "responded" | "lapsed" | "resolved";

export type PackageCheck = { type: CheckType; count: number; required_documents: string[]; turnaround_days: number };

export type BgvPackage = {
  id: string;
  name: string;
  description: string | null;
  checks: PackageCheck[];
  turnaround_target_days: number | null;
  lawful_confirmed_by: string | null;
  lawful_confirmed_at: string | null;
  archived_at: string | null;
  created_at: string;
};

export type PackageIn = {
  name: string;
  description?: string | null;
  checks: PackageCheck[];
  turnaround_target_days?: number | null;
  lawful_confirmed?: boolean;
};

export type BgvProvider = {
  id: string;
  name: string;
  kind: "internal" | "external";
  contact_name: string | null;
  contact_email: string | null;
  supported_types: CheckType[];
  connector_config_id: string | null;
  active: boolean;
};

export type ProviderIn = Partial<Omit<BgvProvider, "id">> & { name: string };

export type Question = { key: string; text: string; kind: "text" | "rating" | "yes_no"; required: boolean };

export type Questionnaire = { id: string; name: string; questions: Question[]; is_default: boolean; archived_at: string | null };

export type DocumentRequest = {
  id: string;
  key: string;
  label: string;
  kind: "upload" | "declaration";
  required: boolean;
  status: "requested" | "submitted" | "accepted" | "returned";
  file_ids: string[];
  declared: Record<string, unknown> | null;
  return_note: string | null;
  redaction_confirmed_by: string | null;
  submitted_at: string | null;
};

export type ProviderProposal = {
  result: CheckResult;
  note: string | null;
  verifier_name: string | null;
  source_contacted: string | null;
  verified_on: string | null;
  evidence_file_ids: string[];
  submitted_at: string;
};

export type BgvCheck = {
  id: string;
  case_id: string;
  type: CheckType;
  seq: number;
  subject_label: string;
  document_request_keys: string[];
  turnaround_days: number | null;
  status: CheckStatus;
  halted_reason: string | null;
  assignee_kind: "internal" | "provider" | null;
  assignee_user_id: string | null;
  provider_id: string | null;
  provider_name: string | null;
  external_ref: string | null;
  connector_job_id: string | null;
  started_at: string | null;
  due_on: string | null;
  overdue: boolean;
  result_note: string | null;
  verifier_name: string | null;
  source_contacted: string | null;
  verified_on: string | null;
  recorded_by: string | null;
  recorded_at: string | null;
  waived_reason: string | null;
  provider_proposal: ProviderProposal | null;
  reference_check_id: string | null;
  evidence_file_ids: string[];
  provider_link_active: boolean;
};

export type Discrepancy = {
  id: string;
  case_id: string;
  check_id: string;
  severity: Severity;
  description: string;
  internal_note: string | null;
  status: DiscrepancyStatus;
  response_due_on: string;
  candidate_response: string | null;
  response_file_ids: string[];
  responded_at: string | null;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type CaseListItem = {
  id: string;
  human_id: string;
  candidate_id: string;
  candidate_name: string | null;
  placement_id: string | null;
  client_id: string | null;
  package_id: string;
  package_name: string | null;
  required: boolean;
  status: CaseStatus;
  outcome_qualifier: "with_exceptions" | null;
  overdue_checks: number;
  open_discrepancies: number;
  created_at: string;
  age_days: number;
};

export type CaseOut = CaseListItem & {
  application_id: string | null;
  consent_active: boolean;
  consent_withdrawn_at: string | null;
  adjudication_reasons: string | null;
  adjudicated_by: string | null;
  adjudicated_at: string | null;
  cancel_reason: string | null;
  evidence_purge_after: string | null;
  evidence_purged_at: string | null;
  started_at: string | null;
  documents: DocumentRequest[];
  checks: BgvCheck[];
  discrepancies: Discrepancy[];
  discrepancy_awaiting_response: boolean;
  lock_version: number;
};

export type CaseSummary = {
  id: string;
  human_id: string;
  package_name: string | null;
  required: boolean;
  status: CaseStatus;
  outcome_qualifier: string | null;
  adjudicated_at: string | null;
};

export type CaseEvent = {
  id: string;
  kind: string;
  from_status: string | null;
  to_status: string | null;
  actor_kind: string;
  actor_id: string | null;
  detail: Record<string, unknown>;
  at: string;
};

export type ResultIn = {
  result: CheckResult;
  note?: string | null;
  verifier_name?: string | null;
  source_contacted?: string | null;
  verified_on?: string | null;
  evidence_file_ids?: string[];
  accept_proposal?: boolean;
  discrepancy?: { severity: Severity; description: string; internal_note?: string | null } | null;
};

export type AdjudicateIn = { outcome: "clear" | "failed"; with_exceptions: boolean; reasons: string };

// ---------------------------------------------------------------- worker portal
export type PortalDocument = {
  key: string;
  label: string;
  kind: "upload" | "declaration";
  required: boolean;
  status: DocumentRequest["status"];
  file_count: number;
  declared: Record<string, unknown> | null;
  return_note: string | null;
};

export type PortalCase = {
  id: string;
  human_id: string;
  status: "in_progress" | "clear" | "failed";
  stage: string;
  consent_given: boolean;
  check_types: CheckType[];
  documents: PortalDocument[];
  documents_submitted: boolean;
  created_at: string;
};

export type PortalConsentView = {
  case_id: string;
  notice_id: string;
  title: string;
  body_md: string;
  version: number;
  check_types: CheckType[];
  providers: string[];
  consent_given: boolean;
};

export type PortalDiscrepancy = {
  id: string;
  case_id: string;
  check_type: CheckType;
  severity: Severity;
  description: string;
  status: DiscrepancyStatus;
  response_due_on: string;
  candidate_response: string | null;
  responded_at: string | null;
};

// ---------------------------------------------------------------- public provider page
export type ProviderCheckView = {
  tenant_name: string | null;
  check_type: CheckType;
  subject_label: string;
  candidate_name: string | null;
  files: { file_id: string; original_name: string; uploaded_by_kind: string }[];
  declarations: Record<string, unknown>;
  submitted: boolean;
};
