/**
 * Internal Mobility (Epic 41) -- hand-written API types (the generated schema predates these endpoints).
 * Mirrors `Backend/app/schemas/mobility.py` and `mobility_portal.py`. Money / percentages are Decimal strings.
 */
import type { MatchOut } from "@/lib/api/types";

export type MobilityStatus = "applied" | "manager_approval" | "approved" | "manager_rejected" | "withdrawn" | "transfer_confirmed";
export type EmployeeKind = "user" | "worker";
export type SubjectKind = "user" | "worker";
export type Visibility = "internal" | "both";
export type RateUnit = "hour" | "day" | "month" | "fixed";

// ---------------------------------------------------------------- settings
export type MobilitySettingsOut = {
  board_enabled: boolean;
  worker_board_enabled: boolean;
  screen_before_manager: boolean;
  fallback_approver_role_key: string;
  min_tenure_default_months: number | null;
  disclosure_text: string;
};
export type MobilitySettingsPatch = Partial<MobilitySettingsOut>;

// ---------------------------------------------------------------- board
export type OpeningSkill = { name: string; min_proficiency: number | null };

export type OpeningOut = {
  demand_id: string;
  title: string;
  location_text: string | null;
  work_mode: string | null;
  employment_type: string | null;
  skills: OpeningSkill[];
  visibility: Visibility;
  opened_at: string;
  closes_at: string | null;
  eligible: boolean;
  reasons: string[];
  fit_pct: number | null;
  fit_reasons: string[];
  application_id: string | null;
  application_status: MobilityStatus | null;
};

export type OpeningDetailOut = OpeningOut & { summary_html: string; disclosure_text: string; can_apply: boolean };

export type OpeningPage = { items: OpeningOut[]; total: number; page: number; page_size: number; board_enabled: boolean };

export type OpeningFilters = { q: string; location: string; includeIneligible: boolean; page: number; pageSize: number };

export type ProfilePreviewOut = {
  candidate_id: string | null;
  will_create: boolean;
  full_name: string;
  email: string;
  current_title: string | null;
  skills: string[];
};

export type ApplyIn = { disclosure_ack: boolean; cover_note?: string | null };

export type MyApplicationOut = {
  id: string;
  demand_id: string;
  demand_title: string;
  status: MobilityStatus;
  stage_name: string | null;
  rejection_reason: string | null;
  submitted_at: string;
  decided_at: string | null;
  can_withdraw: boolean;
};

// Worker portal shapes are identical.
export type WorkerOpeningOut = OpeningOut;
export type WorkerOpeningDetailOut = OpeningDetailOut;
export type WorkerOpeningPage = OpeningPage;
export type WorkerApplicationOut = MyApplicationOut;

// ---------------------------------------------------------------- recruiter / manager
export type TransferOut = {
  id: string;
  mobility_application_id: string;
  employee_kind: EmployeeKind;
  candidate_id: string;
  user_id: string | null;
  from_placement_id: string | null;
  to_placement_id: string | null;
  to_placement_human_id: string | null;
  effective_date: string;
  previous_last_working_day: string | null;
  from_team_id: string | null;
  to_team_id: string | null;
  to_role_title: string | null;
  confirmed_by: string;
  confirmed_at: string;
  note: string | null;
};

export type InternalApplicationOut = {
  id: string;
  application_id: string;
  application_human_id: string | null;
  demand_id: string;
  demand_title: string | null;
  candidate_id: string;
  candidate_name: string | null;
  employee_kind: EmployeeKind;
  user_id: string | null;
  current_placement_id: string | null;
  status: MobilityStatus;
  stage_key: string | null;
  approval_request_id: string | null;
  manager_user_id: string | null;
  manager_name: string | null;
  rejection_reason: string | null;
  cover_note: string | null;
  submitted_at: string;
  decided_at: string | null;
  transfer: TransferOut | null;
};

export type CurrentPlacementOut = {
  id: string;
  human_id: string;
  status: string;
  role_title: string | null;
  actual_start_date: string | null;
  planned_start_date: string;
  end_date: string | null;
  legal_entity_id: string;
  worker_type: string | null;
  engagement_kind: string | null;
  currency: string;
  rate_unit: string | null;
  pay_rate: string | null;
  bill_rate: string | null;
  burden_pct: string | null;
  open_offboarding: boolean;
  open_extension: boolean;
};

export type TransferContextOut = {
  mobility_application_id: string;
  employee_kind: EmployeeKind;
  status: MobilityStatus;
  stage_key: string | null;
  can_confirm: boolean;
  blocking_reason: string | null;
  demand_id: string;
  demand_title: string | null;
  client_id: string | null;
  current_placement: CurrentPlacementOut | null;
  earliest_effective_date: string;
};

export type TransferConfirmIn = {
  effective_date: string;
  note?: string | null;
  to_role_title?: string | null;
  to_team_id?: string | null;
  legal_entity_id?: string | null;
  worker_type?: string | null;
  engagement_kind?: string | null;
  currency?: string | null;
  rate_unit?: RateUnit | null;
  pay_rate?: string | null;
  bill_rate?: string | null;
  burden_pct?: string | null;
  work_location_text?: string | null;
  account_manager_user_id?: string | null;
};

// ---------------------------------------------------------------- rules / profiles
export type OpeningRulesIn = {
  min_tenure_months?: number | null;
  grades?: string[] | null;
  locations?: string[] | null;
  business_unit_ids?: string[] | null;
  note?: string | null;
};

export type OpeningRulesOut = {
  demand_id: string;
  visibility: string;
  min_tenure_months: number | null;
  grades: string[] | null;
  locations: string[] | null;
  business_unit_ids: string[] | null;
  note: string | null;
  on_board: boolean;
};

export type ProfileIn = { subject_kind: SubjectKind; subject_id: string; grade?: string | null; location?: string | null };

export type ProfileOut = {
  id: string;
  subject_kind: SubjectKind;
  subject_id: string;
  subject_name: string | null;
  subject_email: string | null;
  grade: string | null;
  location: string | null;
  updated_at: string;
};

export type ProfileImportRow = {
  line: number;
  email: string;
  subject_kind: SubjectKind | null;
  subject_id: string | null;
  grade: string | null;
  location: string | null;
  error: string | null;
};

export type ProfileImportOut = { validate_only: boolean; rows: ProfileImportRow[]; applied: number; errors: number };

// ---------------------------------------------------------------- matching sections
export type MatchSection<T = MatchOut> = { key: string; label: string; order: number; total: number; items: T[] };
