/**
 * Immigration DTOs (Epic 46), hand-mirrored from `Backend/app/schemas/immigration.py` and
 * `Backend/app/schemas/immigration_portal.py`. Dates are ISO `YYYY-MM-DD` strings, datetimes ISO strings.
 * Encrypted numbers only ever arrive as `*_last4`; plaintext comes once from the audited unmask endpoints.
 */

export type CaseStatus = "open" | "in_stage" | "approved" | "refused" | "withdrawn";
export type StageCategory = "preparing" | "filed" | "pending_decision";
export type VisaCategory = "work" | "dependent" | "business_travel";
export type CollectFrom = "worker" | "counsel" | "internal";
export type AppliesTo = "principal" | "dependant" | "employer" | "counsel";
export type RequestStatus = "requested" | "uploaded" | "verified" | "rejected" | "waived";
export type CaseAction = "move_stage" | "approve" | "refuse" | "withdraw" | "record_permit";
export type Relationship = "spouse" | "child" | "parent" | "other";
export type DependantVisaStatus = "not_started" | "in_progress" | "approved" | "refused" | "withdrawn";
export type PermitStatus = "active" | "expired" | "future" | "superseded";

// ---------------------------------------------------------------- definition
export type ValidityRule = { min_months_remaining?: number | null; max_age_days?: number | null };

export type StageDef = { key: string; label: string; category: string; sla_days?: number | null; help?: string | null };

export type ChecklistItemDef = {
  key: string;
  label: string;
  document_category: string;
  mandatory: boolean;
  applies_to: AppliesTo;
  collect_from: CollectFrom;
  validity_rule?: ValidityRule | null;
  help?: string | null;
};

export type ExpiryFieldDef = { key: string; label: string; primary: boolean; required: boolean };

export type KeyDateDef = { key: string; label: string };

export type VisaTypeDefinition = {
  stages: StageDef[];
  checklist: ChecklistItemDef[];
  expiry_fields: ExpiryFieldDef[];
  alert_offsets: number[];
  key_dates: KeyDateDef[];
};

// ---------------------------------------------------------------- templates / visa types
export type VisaTemplateOut = {
  key: string;
  country: string;
  name: string;
  category: string;
  template_version: number;
  last_reviewed: string;
  notice: string;
  definition: VisaTypeDefinition;
  adopted_visa_type_id: string | null;
};

export type AdoptIn = { name?: string | null; key?: string | null };

export type VisaTypeCreate = {
  key: string;
  name: string;
  country: string;
  category: VisaCategory;
  definition: VisaTypeDefinition;
  last_reviewed?: string | null;
};

export type VisaTypePatch = { name?: string | null; active?: boolean | null; last_reviewed?: string | null };

export type VisaTypeVersionOut = { id: string; version_no: number; created_by: string | null; created_at: string };

export type VisaTypeOut = {
  id: string;
  key: string;
  country: string;
  name: string;
  category: string;
  active: boolean;
  archived_at: string | null;
  template_key: string | null;
  template_version: number | null;
  template_last_reviewed: string | null;
  last_reviewed: string | null;
  disclaimer: string;
  current_version_id: string | null;
  current_version_no: number | null;
  credential_type_key: string;
  open_cases: number;
};

export type VisaTypeDetailOut = VisaTypeOut & { definition: VisaTypeDefinition; versions: VisaTypeVersionOut[] };

// ---------------------------------------------------------------- counsel
export type CounselIn = { name: string; firm?: string | null; email?: string | null; phone?: string | null; notes?: string | null };
export type CounselPatch = Partial<CounselIn> & { archived?: boolean | null };
export type CounselOut = {
  id: string;
  name: string;
  firm: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  archived_at: string | null;
};

// ---------------------------------------------------------------- cases
export type CaseCreate = {
  candidate_id: string;
  visa_type_id: string;
  owner_user_id?: string | null;
  placement_id?: string | null;
  project_id?: string | null;
  demand_id?: string | null;
  counsel_id?: string | null;
  sponsoring_legal_entity_id?: string | null;
};

export type CasePatch = {
  owner_user_id?: string | null;
  placement_id?: string | null;
  project_id?: string | null;
  demand_id?: string | null;
  counsel_id?: string | null;
  sponsoring_legal_entity_id?: string | null;
  lock_version?: number | null;
};

export type StageOut = { key: string; label: string; category: string; sla_days: number | null };

export type CaseSummaryOut = {
  id: string;
  human_id: string;
  candidate_id: string;
  candidate_name: string | null;
  visa_type_id: string;
  visa_type_name: string;
  visa_type_version_no: number | null;
  country: string;
  status: CaseStatus;
  stage_key: string | null;
  stage_label: string | null;
  stage_category: string | null;
  stage_entered_at: string | null;
  owner_user_id: string;
  owner_name: string | null;
  receipt_number_last4: string | null;
  next_key_date: string | null;
  next_key_date_label: string | null;
  overdue: boolean;
  created_at: string;
};

export type CaseOut = CaseSummaryOut & {
  placement_id: string | null;
  project_id: string | null;
  demand_id: string | null;
  business_unit_id: string | null;
  counsel_id: string | null;
  counsel_name: string | null;
  sponsoring_legal_entity_id: string | null;
  key_dates: Record<string, string>;
  outcome_at: string | null;
  outcome_note: string | null;
  withdraw_reason: string | null;
  lock_version: number;
  stages: StageOut[];
  key_date_defs: KeyDateDef[];
  expiry_fields: ExpiryFieldDef[];
  allowed_actions: string[];
  disclaimer: string;
};

export type CaseEventOut = {
  id: string;
  kind: string;
  from_stage: string | null;
  to_stage: string | null;
  actor: Record<string, unknown>;
  payload: Record<string, unknown>;
  at: string;
};

export type PermitIn = {
  permit_type?: string | null;
  number: string;
  valid_from: string;
  valid_to?: string | null;
  expiry_values?: Record<string, string>;
  conditions?: string | null;
  document_id?: string | null;
};

export type OutcomeIn = { outcome: "approved" | "refused"; note?: string | null; permit?: PermitIn | null };

export type UnmaskOut = { number: string };

export type DependantIn = {
  name: string;
  relationship: Relationship;
  nationality?: string | null;
  passport_number?: string | null;
  visa_status?: DependantVisaStatus;
  notes?: string | null;
};
export type DependantPatch = Partial<DependantIn>;
export type DependantOut = {
  id: string;
  name: string;
  relationship: string;
  nationality: string | null;
  passport_number_last4: string | null;
  visa_status: string;
  notes: string | null;
};

// ---------------------------------------------------------------- document requests
export type RequestOut = {
  id: string;
  case_id: string;
  checklist_key: string;
  label: string;
  document_category: string;
  dependant_id: string | null;
  dependant_name: string | null;
  collect_from: string;
  mandatory: boolean;
  status: RequestStatus;
  document_id: string | null;
  rejection_reason: string | null;
  requested_at: string | null;
  uploaded_at: string | null;
  verified_at: string | null;
  due_date: string | null;
  warnings: string[];
};

export type SendIn = { request_ids: string[]; due_date?: string | null };
export type SendOut = { notified_worker: number; worker_links: number; counsel_links: number; internal: number };
export type VerifyOut = { request: RequestOut; warnings: string[] };

// ---------------------------------------------------------------- permits
export type PermitOut = {
  id: string;
  case_id: string;
  candidate_id: string;
  visa_type_id: string;
  country: string;
  permit_type: string;
  number_last4: string | null;
  valid_from: string;
  valid_to: string | null;
  expiry_values: Record<string, string>;
  conditions: string | null;
  document_id: string | null;
  credential_id: string | null;
  superseded_by_id: string | null;
  status: PermitStatus;
  created_at: string;
};

// ---------------------------------------------------------------- dashboard
export type DashboardTile = { key: string; label: string; count: number; filters: Record<string, string> };
export type StageCount = { category: string; stage_key: string | null; stage_label: string; count: number };
export type CountryCount = { country: string; count: number };
export type DashboardOut = { tiles: DashboardTile[]; by_stage: StageCount[]; by_country: CountryCount[] };
export type AtRiskOut = {
  placement_id: string;
  placement_human_id: string;
  candidate_id: string;
  candidate_name: string | null;
  work_country: string;
  case_id: string | null;
  case_human_id: string | null;
};

// ---------------------------------------------------------------- worker portal
export type PortalRequestOut = {
  id: string;
  label: string;
  for_dependant: string | null;
  mandatory: boolean;
  status: string;
  rejection_reason: string | null;
  due_date: string | null;
  can_upload: boolean;
};

export type PortalCaseOut = {
  id: string;
  reference: string;
  country: string;
  visa_type_name: string;
  status: string;
  status_label: string;
  stage_label: string | null;
  open_requests: number;
  updated_at: string;
};

export type PortalCaseDetailOut = PortalCaseOut & { requests: PortalRequestOut[] };

export type PortalNoticeOut = { notice_id: string | null; version: number | null; title: string; body_md: string };

export type PortalCasesOut = { cases: PortalCaseOut[]; consent_given: boolean; notice: PortalNoticeOut };

// ---------------------------------------------------------------- public counsel upload
export type PublicUploadItemOut = { id: string; label: string; status: string; can_upload: boolean };

export type PublicUploadViewOut = {
  reference: string;
  tenant_name: string | null;
  expires_at: string;
  uses_left: number;
  items: PublicUploadItemOut[];
  notice_title: string;
  notice_body_md: string;
  consent_required: boolean;
};

export type PublicUploadOut = { status: string; item_id: string };
