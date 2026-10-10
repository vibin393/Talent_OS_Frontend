/**
 * Leave & Holidays types (Epic 26), hand-written to mirror `app/schemas/leave.py` and `leave_portal.py`.
 * Days are decimal strings ("1.50"); never parsed to floats for arithmetic.
 */

export type LeaveStatus = "requested" | "approved" | "rejected" | "withdrawn" | "cancellation_requested" | "cancelled";
export type ScopeKind = "country" | "state" | "client" | "legal_entity";
export type HolidayType = "national" | "state" | "optional" | "client";
export type AccrualMode = "monthly" | "annual_grant" | "none";

export interface HolidayOut {
  id: string;
  calendar_id: string;
  holiday_date: string;
  name: string;
  type: HolidayType;
}

export interface HolidayIn {
  holiday_date: string;
  name: string;
  type: HolidayType;
}

export interface HolidayCalendarOut {
  id: string;
  name: string;
  year: number;
  scope_kind: ScopeKind;
  country_code: string;
  state_code: string | null;
  client_id: string | null;
  legal_entity_id: string | null;
  optional_allowance: number;
  copied_from_id: string | null;
  archived_at: string | null;
  holiday_count: number;
}

export interface HolidayCalendarDetail extends HolidayCalendarOut {
  holidays: HolidayOut[];
}

export interface HolidayCalendarIn {
  name: string;
  year: number;
  scope_kind: ScopeKind;
  country_code?: string;
  state_code?: string | null;
  client_id?: string | null;
  legal_entity_id?: string | null;
  optional_allowance?: number;
  holidays?: HolidayIn[];
}

export interface CopyCalendarOut {
  calendar: HolidayCalendarOut;
  copied: { id: string; holiday_date: string; name: string; type: HolidayType; needs_review: boolean }[];
  skipped: { holiday_date: string; name: string; reason: string }[];
}

export interface LeaveTypeOverrideOut {
  id: string;
  leave_type_id: string;
  client_id: string;
  accrual_amount: string | null;
  cap: string | null;
  billable: boolean | null;
  requires_client_approval: boolean | null;
}

export interface LeaveTypeOut {
  id: string;
  code: string;
  name: string;
  paid: boolean;
  billable: boolean;
  accrual_mode: AccrualMode;
  accrual_amount: string;
  cap: string | null;
  carry_forward_limit: string | null;
  allow_negative: boolean;
  negative_limit: string | null;
  allow_half_day: boolean;
  eligible_worker_types: string[];
  eligible_legal_entity_ids: string[];
  timesheet_category: string;
  archived_at: string | null;
  overrides: LeaveTypeOverrideOut[];
}

export interface LeaveTypeIn {
  code: string;
  name: string;
  paid: boolean;
  billable: boolean;
  accrual_mode: AccrualMode;
  accrual_amount: string;
  cap?: string | null;
  carry_forward_limit?: string | null;
  allow_negative: boolean;
  negative_limit?: string | null;
  allow_half_day: boolean;
}

export interface LeaveTypeOverrideIn {
  accrual_amount?: string | null;
  cap?: string | null;
  billable?: boolean | null;
  requires_client_approval?: boolean | null;
}

export interface LeaveBalanceOut {
  candidate_id: string;
  leave_type_id: string;
  leave_type_code: string;
  leave_type_name: string;
  legal_entity_id: string;
  leave_year: string;
  balance: string;
  pending: string;
  available: string;
  paid: boolean;
}

export interface LeaveLedgerEntryOut {
  id: string;
  leave_type_id: string;
  legal_entity_id: string;
  leave_year: string;
  entry_kind: string;
  days: string;
  effective_date: string;
  source_ref: string;
  reason: string | null;
  actor_kind: string;
  created_at: string;
}

export interface AdjustBalanceIn {
  candidate_id: string;
  leave_type_id: string;
  legal_entity_id: string;
  days: string;
  reason: string;
  leave_year?: string | null;
}

export interface LeaveRequestOut {
  id: string;
  human_id: string;
  candidate_id: string;
  worker_name: string | null;
  placement_id: string;
  client_id: string;
  client_name: string | null;
  legal_entity_id: string;
  leave_type_id: string;
  leave_type_name: string | null;
  leave_year: string;
  start_date: string;
  end_date: string;
  start_half: string | null;
  end_half: string | null;
  days: string;
  reason: string | null;
  status: LeaveStatus;
  approval_request_id: string | null;
  requested_by_kind: string;
  proxy_reason: string | null;
  decided_at: string | null;
  decision_comment: string | null;
  created_at: string;
}

export interface LeaveCalendarDay {
  date: string;
  half: "am" | "pm" | null;
  status: "requested" | "approved";
  leave_type_name: string | null;
}

export interface LeaveCalendarWorker {
  candidate_id: string;
  worker_name: string | null;
  placement_id: string;
  client_id: string;
  days: LeaveCalendarDay[];
}

export interface HolidayDayOut {
  date: string;
  name: string;
  type: HolidayType;
  holiday_id: string;
  calendar_id: string;
  optional: boolean;
  selected: boolean;
}

export interface LeaveCalendarOut {
  start: string;
  end: string;
  workers: LeaveCalendarWorker[];
  holidays: HolidayDayOut[];
}

// ---------------------------------------------------------------- Worker portal
export interface WorkerLeaveTypeOut {
  id: string;
  code: string;
  name: string;
  paid: boolean;
  allow_half_day: boolean;
}

export interface WorkerLeaveBalanceOut {
  leave_type_id: string;
  leave_type_name: string;
  leave_year: string;
  balance: string;
  pending: string;
  available: string;
}

export interface WorkerLeaveRequestOut {
  id: string;
  human_id: string;
  placement_id: string;
  leave_type_id: string;
  leave_type_name: string | null;
  start_date: string;
  end_date: string;
  start_half: string | null;
  end_half: string | null;
  days: string;
  reason: string | null;
  status: LeaveStatus;
  decided_at: string | null;
  decision_comment: string | null;
  created_at: string;
}

export interface WorkerLeavePreviewOut {
  days: string;
  working_dates: string[];
  available: string | null;
  sufficient: boolean;
  error_code: string | null;
}

export interface WorkerHolidayOut {
  holiday_id: string;
  date: string;
  name: string;
  type: HolidayType;
  optional: boolean;
  selected: boolean;
}

export interface WorkerHolidaysOut {
  year: number;
  placement_id: string | null;
  optional_allowance: number;
  optional_selected: number;
  holidays: WorkerHolidayOut[];
}

export interface LeaveRequestIn {
  leave_type_id: string;
  start_date: string;
  end_date: string;
  start_half?: "pm" | null;
  end_half?: "am" | null;
  reason?: string | null;
  placement_id?: string | null;
}

// ---------------------------------------------------------------- Client portal (no type, reason or balances)
export interface ClientLeaveCalendarDay {
  date: string;
  half: "am" | "pm" | null;
  label: "On leave";
}

export interface ClientLeaveCalendarRow {
  worker_name: string | null;
  placement_id: string;
  days: ClientLeaveCalendarDay[];
}

export interface ClientLeaveCalendarOut {
  start: string;
  end: string;
  rows: ClientLeaveCalendarRow[];
}
