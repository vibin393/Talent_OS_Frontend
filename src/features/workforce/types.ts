/**
 * Epic 44 (workforce planning) API types. Hand-written mirrors of `Backend/app/schemas/workforce.py` and
 * `workforce_portal.py` (`npm run gen:api` is not used). Money (Decimal) arrives and is sent as strings; dates
 * are ISO strings; months are `YYYY-MM`.
 */

export type PlanStatus = "draft" | "budgeted" | "pending_approval" | "approved" | "rejected" | "revision_draft";
export type PlanOrigin = "internal" | "client_forecast";
export type LineType = "new" | "replacement" | "project" | "recurring";
export type WorkMode = "onsite" | "remote" | "hybrid";
export type LineRateUnit = "hour" | "day" | "month" | "annual";
export type ChangeKind = "unchanged" | "added" | "modified" | "removed";
export type SlotStatus = "open" | "requisitioned" | "filled" | "cancelled";
export type GroupBy = "line" | "month";

export type SlotCounts = { open: number; requisitioned: number; filled: number; cancelled: number };

export type PlanOut = {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  fiscal_label: string | null;
  business_unit_id: string | null;
  client_id: string | null;
  client_name: string | null;
  project_id: string | null;
  currency: string;
  status: PlanStatus;
  origin: PlanOrigin;
  owner_id: string;
  owner_name: string | null;
  submitted_by_client_user_id: string | null;
  approved_revision: number | null;
  current_revision: number;
  approval_request_id: string | null;
  notes: string | null;
  picked_up_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  line_count: number;
  total_headcount: number;
  total_budget: string | null;
  money_masked: boolean;
  slots: SlotCounts;
  editable: boolean;
};

export type PlanFilters = { status?: string; client_id?: string; origin?: string; q?: string };

export type PlanCreate = {
  name: string;
  period_start: string;
  period_end: string;
  business_unit_id?: string | null;
  client_id?: string | null;
  project_id?: string | null;
  currency?: string | null;
  notes?: string | null;
};

export type PlanUpdate = Partial<PlanCreate>;

export type PlanCopyIn = { name: string; period_start: string };

export type LineSkillIn = { skill_key?: string | null; name?: string | null; min_proficiency?: number | null };
export type LineSkillOut = { skill_key: string | null; name: string; min_proficiency: number | null };

export type LineIn = {
  role_title: string;
  skills: LineSkillIn[];
  headcount: number;
  line_type: LineType;
  location_text?: string | null;
  work_mode?: WorkMode | null;
  start_month: string;
  end_month?: string | null;
  /** Decimal string ("1200.50"), never a JS number. */
  budget_amount?: string | null;
  bill_rate_amount?: string | null;
  rate_unit?: LineRateUnit | null;
  project_role_id?: string | null;
  notes?: string | null;
};

export type LineUpdate = Partial<LineIn>;

export type LineOut = {
  id: string;
  lineage_id: string;
  workforce_plan_id: string;
  revision: number;
  role_title: string;
  skills: LineSkillOut[];
  headcount: number;
  line_type: LineType;
  location_text: string | null;
  work_mode: WorkMode | null;
  start_month: string;
  period_start: string;
  period_end: string;
  budget_amount: string | null;
  bill_rate_amount: string | null;
  rate_unit: LineRateUnit | null;
  project_role_id: string | null;
  status: string;
  derived_status: string;
  change_kind: ChangeKind;
  supersedes_line_id: string | null;
  notes: string | null;
  client_comment: string | null;
  slots: SlotCounts;
};

export type ImportRowError = { row: number; field: string | null; message: string };

export type LineImportOut = {
  batch_id: string | null;
  applied: boolean;
  row_count: number;
  valid_count: number;
  error_count: number;
  created: number;
  errors: ImportRowError[];
};

export type RevisionOut = {
  id: string;
  revision_no: number;
  status: string;
  reason: string | null;
  created_by: string | null;
  approval_request_id: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  created_at: string;
  changed_lines: number;
};

/** A JSON value of a line snapshot in a diff (`before` / `after`). */
export type DiffValue = string | number | boolean | null | DiffValue[] | { [key: string]: DiffValue };

export type DiffLine = {
  lineage_id: string;
  line_id: string;
  change_kind: ChangeKind;
  role_title: string;
  before: Record<string, DiffValue> | null;
  after: Record<string, DiffValue> | null;
  changed_fields: string[];
};

export type DiffOut = { revision_no: number; status: string; money_masked: boolean; lines: DiffLine[] };

export type SlotOut = {
  id: string;
  workforce_plan_id: string;
  plan_line_id: string;
  line_id: string | null;
  role_title: string | null;
  start_month: string | null;
  seq: number;
  status: SlotStatus;
  demand_id: string | null;
  demand_human_id: string | null;
  demand_status: string | null;
  placement_id: string | null;
  converted_at: string | null;
  requisitioned_at: string | null;
  filled_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
};

export type ConvertOverrides = {
  title?: string | null;
  priority?: "low" | "medium" | "high" | "critical" | null;
  target_closure_date?: string | null;
  start_date?: string | null;
};

export type ConvertIn = { slot_ids: string[]; client_id?: string | null; overrides?: ConvertOverrides | null };

export type ConvertOut = { converted: { slot_id: string; demand_id: string; demand_human_id: string | null }[] };

export type ActualRow = {
  key: string;
  line_id: string | null;
  lineage_id: string | null;
  role_title: string | null;
  month: string | null;
  planned: number;
  requisitioned: number;
  filled: number;
  open: number;
  cancelled: number;
  budget: string | null;
  committed: string | null;
  variance: string | null;
  pending_commitment: boolean;
  fx_missing: boolean;
  demand_ids: string[];
};

export type ActualsOut = {
  plan_id: string;
  group_by: GroupBy;
  currency: string;
  money_masked: boolean;
  effective_revision: number | null;
  rows: ActualRow[];
  totals: ActualRow;
};

export type WorkforceSettings = {
  standard_hours_per_month: string;
  standard_days_per_month: string;
  max_headcount_per_line: number;
};

export type WorkforceSettingsPatch = Partial<WorkforceSettings>;

// ---------------------------------------------------------------- client portal forecasts
export type ForecastStatus = "submitted" | "in_review" | "approved" | "declined";

export type ForecastLineIn = {
  role_title: string;
  skills: { name: string }[];
  headcount: number;
  location_text?: string | null;
  planned_start_month: string;
  notes?: string | null;
};

export type ForecastIn = { name: string; period_start: string; period_end: string; lines: ForecastLineIn[] };

export type ForecastUpdate = Partial<ForecastIn>;

export type ForecastPortalOut = {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  status: ForecastStatus;
  created_at: string;
  line_count: number;
  total_headcount: number;
  editable: boolean;
};

export type ForecastLinePortalOut = {
  id: string;
  role_title: string;
  skills: string[];
  headcount: number;
  location_text: string | null;
  planned_start_month: string;
  comment: string | null;
};

export type ForecastPortalDetail = ForecastPortalOut & { lines: ForecastLinePortalOut[] };
