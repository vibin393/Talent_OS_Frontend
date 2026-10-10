// Hand-written aliases of the Epic 21 compliance API (mirrors app/schemas/compliance*.py).

export type NumberKind = "none" | "encrypted" | "aadhaar_last4";
export type ItemKind = "credential" | "document" | "bgv_package" | "policy_ack";
export type CredentialCategory =
  | "passport"
  | "visa_work_permit"
  | "certification"
  | "professional_licence"
  | "insurance"
  | "client_document"
  | "identity"
  | "other";
export type CredentialStatus = "pending_verification" | "valid" | "expiring_soon" | "expired" | "rejected" | "superseded";
export type ItemStatus = "missing" | "pending" | "met" | "expiring" | "expired" | "waived";
export type RedactionStatus = "pending_review" | "confirmed" | "rejected";

export type CredentialType = {
  id: string;
  key: string;
  label: string;
  category: CredentialCategory;
  has_expiry: boolean;
  number_kind: NumberKind;
  requires_document: boolean;
  alert_offsets: number[] | null;
  archived_at: string | null;
};

export type CredentialTypeIn = Omit<CredentialType, "id" | "archived_at">;

export type RequirementMatch = {
  role_keywords: string[];
  industries: string[];
  countries: string[];
  worker_types: string[];
  engagement_kinds: string[];
};

export type RequirementItem = { kind: ItemKind; ref: string; mandatory: boolean; label: string; unresolved?: boolean };

export type Requirement = {
  id: string;
  name: string;
  client_id: string | null;
  match: RequirementMatch;
  items: RequirementItem[];
  active: boolean;
  effective_from: string | null;
  archived_at: string | null;
  created_at: string;
  evaluation_run_id: string | null;
};

export type RequirementIn = {
  name: string;
  client_id: string | null;
  match: RequirementMatch;
  items: RequirementItem[];
  active: boolean;
  effective_from: string | null;
};

export type EvaluationRun = {
  id: string;
  requirement_id: string | null;
  started_at: string;
  finished_at: string | null;
  placements_evaluated: number;
  newly_non_compliant: string[];
  placements: { placement_id: string; human_id: string; status: string }[];
};

export type Credential = {
  id: string;
  human_id: string;
  candidate_id: string;
  candidate_name: string | null;
  credential_type_id: string;
  type_key: string;
  type_label: string | null;
  number_kind: NumberKind | null;
  number_last4: string | null;
  issuer: string | null;
  issued_on: string | null;
  expires_on: string | null;
  document_id: string | null;
  redaction_status: RedactionStatus | null;
  verification_status: "pending_verification" | "valid" | "rejected";
  expiry_status: "none" | "expiring_soon" | "expired";
  status: CredentialStatus;
  version_no: number;
  previous_id: string | null;
  superseded_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  rejection_note: string | null;
  source: string;
  created_at: string;
};

export type ChecklistItem = {
  id: string;
  kind: ItemKind;
  ref: string;
  label: string;
  mandatory: boolean;
  status: ItemStatus;
  retroactive: boolean;
  credential_id: string | null;
  waived_reason: string | null;
  waived_by: string | null;
  waived_at: string | null;
  requirement_names: string[];
  unresolved: boolean;
};

export type PlacementCompliance = { placement_id: string; non_compliant: boolean; blocking: boolean; items: ChecklistItem[] };

export type DashboardPlacementRow = {
  placement_id: string;
  human_id: string;
  candidate_name: string | null;
  client_name: string | null;
  status: string;
  blocking: boolean;
  missing: number;
  expired: number;
};

export type DashboardCredentialRow = {
  credential_id: string;
  human_id: string;
  candidate_id: string;
  candidate_name: string | null;
  type_label: string;
  number_last4: string | null;
  expires_on: string | null;
  days_left: number | null;
};

export type ComplianceDashboard = {
  compliant: number;
  non_compliant: number;
  blocking: number;
  retroactive_only: number;
  expiring_30: number;
  expiring_60: number;
  missing_by_kind: Record<string, number>;
  top_non_compliant: DashboardPlacementRow[];
  expiring: DashboardCredentialRow[];
};

export type ComplianceSettings = {
  evaluate_at: "placement_created" | "application_selected";
  default_alert_offsets: number[];
  recompute_hour_local: number;
  timezone: string;
};

// ---------------------------------------------------------------- worker portal
export type PortalCredentialType = Pick<CredentialType, "key" | "label" | "category" | "has_expiry" | "number_kind" | "requires_document">;

export type PortalCredential = {
  id: string;
  type_key: string;
  type_label: string;
  number_last4: string | null;
  issued_on: string | null;
  expires_on: string | null;
  status: Exclude<CredentialStatus, "superseded">;
  needs_reupload: boolean;
  has_document: boolean;
  version_no: number;
};

export type PortalNeeded = { label: string; kind: ItemKind; type_key: string | null; status: ItemStatus };

export type PortalCredentials = {
  credentials: PortalCredential[];
  needed: PortalNeeded[];
  types: PortalCredentialType[];
  expiring_soon: number;
};

export type CredentialForm = {
  type_key: string;
  number?: string;
  issuer?: string;
  issued_on?: string;
  expires_on?: string;
  file?: Blob | File | null;
  filename?: string;
};
