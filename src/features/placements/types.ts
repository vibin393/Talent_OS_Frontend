/**
 * Hand-written aliases of the Epic 19 placement API (`app/schemas/placements_api.py`,
 * `app/schemas/placements_portal.py`). Money arrives as decimal strings; dates as `YYYY-MM-DD`.
 */

export type PlacementStatus = "pre_joining" | "joining_confirmed" | "active" | "offboarding" | "ended" | "dropped";
export type WorkerType = "employee" | "contractor" | "vendor_contractor";
export type EngagementKind = "contract" | "c2h" | "permanent";
export type DropReason = "declined" | "no_show" | "bgv_failed" | "client_cancelled";
export type GateStatus = "pending" | "met" | "failed" | "waived" | "not_required";
export type RateUnit = "hour" | "day" | "month" | "fixed";

export type PlacementListItem = {
  id: string;
  human_id: string;
  status: PlacementStatus;
  candidate_id: string;
  candidate_name: string | null;
  client_id: string;
  client_name: string | null;
  vendor_id: string | null;
  legal_entity_id: string;
  worker_type: WorkerType | null;
  engagement_kind: EngagementKind | null;
  role_title: string | null;
  planned_start_date: string;
  planned_end_date: string | null;
  actual_start_date: string | null;
  end_date: string | null;
  dropout_risk: boolean;
  non_compliant: boolean;
  compliance_blocked: boolean;
  setup_items: string[];
  ending_soon: boolean;
};

export type PlacementOut = PlacementListItem & {
  worker_human_id: string | null;
  legal_entity_name: string | null;
  application_id: string | null;
  offer_id: string | null;
  demand_id: string | null;
  contract_id: string | null;
  po_id: string | null;
  rate_card_line_id: string | null;
  supplier_gst_registration_id: string | null;
  payee_kind: "worker" | "vendor";
  work_location_text: string | null;
  work_state_code: string | null;
  work_timezone: string;
  holiday_calendar_id: string | null;
  approval_route_ref: string | null;
  currency: string;
  account_manager_user_id: string | null;
  recruiter_user_id: string | null;
  manager_user_id: string | null;
  client_manager_contact_id: string | null;
  joining_confirmed_at: string | null;
  joining_confirmed_via: string | null;
  drop_reason: DropReason | null;
  drop_note: string | null;
  dropout_risk_rules: string[];
  dropout_cleared_at: string | null;
  counter_offer_at: string | null;
  counter_offer_note: string | null;
  onboarding_pct: number | null;
  bgv_summary: { case_id?: string; status?: string } | null;
  lock_version: number;
  created_at: string;
  updated_at: string;
};

export type PlacementPage = { items: PlacementListItem[]; total: number; page: number; page_size: number };

export type PlacementCreateBody = {
  candidate_id: string;
  client_id: string;
  legal_entity_id?: string | null;
  engagement_kind: EngagementKind;
  worker_type?: WorkerType | null;
  planned_start_date: string;
  planned_end_date?: string | null;
  currency: string;
  rate_unit: RateUnit;
  pay_rate?: string | null;
  bill_rate?: string | null;
  burden_pct?: string | null;
  role_title?: string | null;
  work_location_text?: string | null;
};

export type RateSegmentOut = {
  id: string;
  placement_id: string;
  effective_from: string;
  effective_to: string | null;
  rate_unit: RateUnit;
  currency: string;
  pay_rate: string | null;
  bill_rate: string | null;
  vendor_rate: string | null;
  burden_pct: string | null;
  vendor_burden_pct: string | null;
  margin_amount: string | null;
  margin_pct: string | null;
  status: "pending_approval" | "active" | "rejected";
  approval_request_id: string | null;
  reason: string | null;
  created_at: string;
};

export type RateSegmentIn = {
  effective_from: string;
  pay_rate?: string | null;
  bill_rate?: string | null;
  vendor_rate?: string | null;
  burden_pct?: string | null;
  reason: string;
};

export type MarginPreviewIn = { pay_rate?: string | null; bill_rate?: string | null; burden_pct?: string | null; currency: string };
export type MarginOut = { margin_amount: string | null; margin_pct: string | null; below_minimum: boolean };

export type StartGateOut = {
  id: string;
  placement_id: string;
  kind: string;
  label: string | null;
  source_ref: string;
  required: boolean;
  status: GateStatus;
  detail: Record<string, unknown>;
  override_id: string | null;
  overridable: boolean;
  refreshed_at: string | null;
};

export type UnmetGate = { id: string; kind: string; label: string; source_ref: string; status: GateStatus };

export type GateOverrideOut = {
  id: string;
  gate_ids: string[];
  reason: string;
  status: "pending" | "approved" | "rejected";
  approval_request_id: string | null;
  requested_by: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

export type TouchpointOut = {
  id: string;
  offset_days: number;
  due_on: string;
  sent_at: string | null;
  responded_at: string | null;
  response: "confirmed" | "question" | null;
  response_note: string | null;
};

export type StatusHistoryOut = {
  id: string;
  from_status: string | null;
  to_status: string;
  actor_kind: string;
  reason: string | null;
  note: string | null;
  at: string;
};

export type PreJoiningRow = {
  placement_id: string;
  human_id: string;
  status: PlacementStatus;
  candidate_id: string;
  candidate_name: string | null;
  client_name: string | null;
  role_title: string | null;
  planned_start_date: string;
  days_to_start: number;
  onboarding_pct: number | null;
  bgv_summary: { status?: string } | null;
  gates_total: number;
  gates_unmet: number;
  last_contact_at: string | null;
  joining_confirmed_at: string | null;
  dropout_risk: boolean;
  dropout_risk_rules: string[];
};

export type BankAccountOut = {
  id: string;
  holder_name: string | null;
  account_number_last4: string | null;
  ifsc: string;
  bank_name: string | null;
  status: "pending_approval" | "active" | "superseded" | "rejected";
  created_at: string;
};

export type BankAccountIn = {
  holder_name: string;
  account_number: string;
  account_number_confirm: string;
  ifsc: string;
  bank_name?: string | null;
};

export type WorkerProfileOut = {
  id: string;
  candidate_id: string;
  worker_human_id: string;
  default_worker_type: WorkerType | null;
  emergency_name: string | null;
  emergency_relation: string | null;
  emergency_phone: string | null;
  pan_last4: string | null;
  pan_name: string | null;
  pan_status: "unverified" | "hr_checked";
};

export type WorkerOut = {
  candidate_id: string;
  full_name: string | null;
  email: string | null;
  profile: WorkerProfileOut | null;
  placements: PlacementListItem[];
  current_placement_id: string | null;
  bank_accounts: BankAccountOut[];
  sections: Record<string, unknown>;
};

export type UnmaskOut = { field: "pan" | "bank_account"; value: string };

// ---------------------------------------------------------------- worker portal
export type PortalPlacementOut = {
  id: string;
  human_id: string;
  status: PlacementStatus;
  client_name: string | null;
  role_title: string | null;
  work_location_text: string | null;
  planned_start_date: string;
  planned_end_date: string | null;
  actual_start_date: string | null;
  joining_confirmed_at: string | null;
  can_confirm_joining: boolean;
  pay_rate: string | null;
  rate_unit: string | null;
  currency: string;
};

export type PortalProfileOut = {
  worker_human_id: string | null;
  full_name: string | null;
  email: string | null;
  emergency_name: string | null;
  emergency_relation: string | null;
  emergency_phone: string | null;
  pan_last4: string | null;
};

export type PortalProfileUpdate = Partial<Pick<PortalProfileOut, "emergency_name" | "emergency_relation" | "emergency_phone">>;

export type JoiningLinkInfo = {
  client_name: string | null;
  role_title: string | null;
  planned_start_date: string;
  candidate_first_name: string | null;
  responded: boolean;
};
