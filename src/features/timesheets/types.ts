/**
 * Timesheet DTOs (Epic 25), hand-written mirrors of `Backend/app/schemas/time.py` (internal API) and
 * `Backend/app/schemas/time_portal.py` (Worker + Client portals). Decimals are strings, dates ISO strings.
 * Worker and Client types never carry rates, amounts or margin (AD-26 / AD-27).
 */

export type TimeCategory = "regular" | "ot" | "double_time" | "holiday" | "leave_paid" | "leave_unpaid";
export type EnterableCategory = "regular" | "holiday" | "leave_paid" | "leave_unpaid";
export type PeriodKind = "weekly" | "biweekly" | "semimonthly" | "monthly";
export type EntryMode = "hours" | "start_end" | "days";
export type RouteStepKind = "placement_account_manager" | "user" | "client_user" | "client_any" | "finance_role";
export type TimesheetStatus = "draft" | "submitted" | "in_approval" | "approved" | "rejected";

export const TIME_CATEGORIES: TimeCategory[] = ["regular", "ot", "double_time", "holiday", "leave_paid", "leave_unpaid"];
export const COMPUTED_CATEGORIES: TimeCategory[] = ["ot", "double_time"];
export const PERIOD_KINDS: PeriodKind[] = ["weekly", "biweekly", "semimonthly", "monthly"];
export const ENTRY_MODES: EntryMode[] = ["hours", "start_end", "days"];
export const ROUTE_STEP_KINDS: RouteStepKind[] = ["placement_account_manager", "user", "client_user", "client_any", "finance_role"];
export const TIMESHEET_STATUSES: TimesheetStatus[] = ["draft", "submitted", "in_approval", "approved", "rejected"];

// ---------------------------------------------------------------- config
export type RouteStep = { kind: RouteStepKind; ref?: string | null; label?: string | null };

export type TimeConfigValues = {
  period_kind: PeriodKind;
  week_start: number;
  entry_mode: EntryMode;
  hours_per_day: string;
  work_days: number[];
  enabled_categories: TimeCategory[];
  ot_daily_threshold: string | null;
  dt_daily_threshold: string | null;
  ot_weekly_threshold: string | null;
  pay_multipliers: Record<string, string>;
  bill_multipliers: Record<string, string>;
  daily_cap: string;
  prefill_holidays: boolean;
  prefill_leave: boolean;
  holiday_calendar_id: string | null;
  approval_route: RouteStep[];
};

export type TimeConfigIn = TimeConfigValues;

export type ClientTimeDefaultsOut = TimeConfigValues & { client_id: string; is_default: boolean; updated_at: string | null };

export type TimesheetConfigOut = TimeConfigValues & {
  id: string;
  placement_id: string;
  version: number;
  effective_period_start: string;
  created_at: string;
};

export type TimeSettingsOut = {
  missing_grace_days: number;
  reminder_offsets: number[];
  copy_previous_enabled: boolean;
  import_allow_client_approved: boolean;
  allow_empty_route: boolean;
};
export type TimeSettingsUpdate = Partial<TimeSettingsOut>;

// ---------------------------------------------------------------- entries
export type SpanIn = { start: string; end: string; break_minutes: number };

export type DayEntryIn = {
  date: string;
  category: TimeCategory;
  hours?: string | null;
  spans?: SpanIn[] | null;
  days?: string | null;
  note?: string | null;
};

export type ProxyEntriesIn = { reason: string; days: DayEntryIn[] };
export type ProxySubmitIn = { reason: string; confirm_zero: boolean };
export type AdjustmentEntryIn = { date: string; category: TimeCategory; delta_hours: string; note?: string | null };
export type AdjustmentIn = { reason: string; entries: AdjustmentEntryIn[] };

export type EntryOut = {
  id: string;
  entry_date: string;
  category: string;
  hours: string;
  entered_hours: string | null;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number | null;
  prefilled: boolean;
  is_proxy: boolean;
  holiday_id: string | null;
  leave_type_id: string | null;
  note: string | null;
};

export type AdjustmentEntryOut = { id: string; entry_date: string; category: string; delta_hours: string; note: string | null };
export type CategoryTotal = { category: string; hours: string };
export type LockFlags = { payroll_locked: boolean; billing_locked: boolean; in_draft_invoice: boolean };
export type ApprovalStepOut = {
  position: number;
  name: string;
  outcome: string | null;
  actor_kind: string | null;
  comment: string | null;
  decided_at: string | null;
};

export type TimesheetSummaryOut = {
  id: string;
  human_id: string;
  placement_id: string;
  placement_human_id: string | null;
  candidate_id: string;
  worker_name: string | null;
  client_id: string;
  client_name: string | null;
  kind: string;
  adjustment_seq: number;
  original_timesheet_id: string | null;
  period_start: string;
  period_end: string;
  status: TimesheetStatus;
  total_hours: string;
  submitted_at: string | null;
  approved_at: string | null;
};

export type TimesheetDetailOut = TimesheetSummaryOut & {
  config_version: number;
  entry_mode: string;
  hours_per_day: string;
  daily_cap: string;
  enabled_categories: string[];
  entries: EntryOut[];
  adjustment_entries: AdjustmentEntryOut[];
  totals: CategoryTotal[];
  locks: LockFlags;
  approval_request_id: string | null;
  current_step: string | null;
  approval_history: ApprovalStepOut[];
  rejection_comment: string | null;
  proxy_reason: string | null;
  reason: string | null;
  client_approval_evidence_file_id: string | null;
};

// ---------------------------------------------------------------- monitor
export type MonitorRow = {
  timesheet_id: string;
  human_id: string;
  placement_id: string;
  placement_human_id: string | null;
  candidate_id: string;
  worker_name: string | null;
  client_id: string;
  client_name: string | null;
  legal_entity_id: string;
  kind: string;
  period_start: string;
  period_end: string;
  status: string;
  current_step: string | null;
  current_approver: string | null;
  age_business_days: number;
  missing: boolean;
  late: boolean;
  total_hours: string;
  currency: string;
  estimated_unbilled_value: string | null;
};
export type CurrencyTotal = { currency: string; estimated_unbilled_value: string | null };
export type MonitorOut = { rows: MonitorRow[]; totals: CurrencyTotal[]; masked: boolean };
export type MonitorFilters = { period_start?: string; legal_entity_id?: string; client_id?: string; status?: string };
export type RemindOut = { sent: string[]; skipped: { timesheet_id: string; code: string }[] };

// ---------------------------------------------------------------- import
export type ImportRowOut = {
  row: number;
  worker: string | null;
  placement_id: string | null;
  date: string | null;
  category: string | null;
  hours: string | null;
  timesheet_id: string | null;
  errors: string[];
};
export type ImportPreviewOut = {
  batch_id: string;
  status: string;
  row_count: number;
  error_count: number;
  mark_client_approved: boolean;
  rows: ImportRowOut[];
};
export type ImportApplyOut = { batch_id: string; applied_rows: number; submitted_timesheet_ids: string[] };

// ================================================================ Worker portal (hours only, no rates)
export type WorkerTimesheetSummary = {
  id: string;
  human_id: string;
  placement_id: string;
  client_name: string | null;
  role_title: string | null;
  kind: string;
  period_start: string;
  period_end: string;
  status: string;
  total_hours: string;
  submitted_at: string | null;
};

export type WorkerEntry = {
  id: string;
  entry_date: string;
  category: string;
  hours: string;
  entered_hours: string | null;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number | null;
  prefilled: boolean;
  deletable: boolean;
  holiday_id: string | null;
  leave_type_id: string | null;
  note: string | null;
};

export type WorkerCategoryTotal = { category: string; hours: string };
export type WorkerAdjustmentEntry = { entry_date: string; category: string; delta_hours: string; note: string | null };

export type WorkerTimesheetOut = WorkerTimesheetSummary & {
  entry_mode: string;
  hours_per_day: string;
  daily_cap: string;
  enabled_categories: string[];
  editable_categories: string[];
  editable: boolean;
  can_recall: boolean;
  can_copy_previous: boolean;
  min_date: string;
  max_date: string;
  entries: WorkerEntry[];
  adjustment_entries: WorkerAdjustmentEntry[];
  totals: WorkerCategoryTotal[];
  rejection_comment: string | null;
};

export type WorkerDaySplit = { date: string; worked: string; regular: string; ot: string; double_time: string };
export type WorkerSplitPreview = { days: WorkerDaySplit[]; totals: WorkerCategoryTotal[] };

/** Field names of the Worker DTOs (kept in sync with the types above; tested to contain no rate/amount field). */
export const WORKER_TIMESHEET_FIELDS: (keyof WorkerTimesheetOut)[] = [
  "id",
  "human_id",
  "placement_id",
  "client_name",
  "role_title",
  "kind",
  "period_start",
  "period_end",
  "status",
  "total_hours",
  "submitted_at",
  "entry_mode",
  "hours_per_day",
  "daily_cap",
  "enabled_categories",
  "editable_categories",
  "editable",
  "can_recall",
  "can_copy_previous",
  "min_date",
  "max_date",
  "entries",
  "adjustment_entries",
  "totals",
  "rejection_comment",
];
export const WORKER_ENTRY_FIELDS: (keyof WorkerEntry)[] = [
  "id",
  "entry_date",
  "category",
  "hours",
  "entered_hours",
  "start_time",
  "end_time",
  "break_minutes",
  "prefilled",
  "deletable",
  "holiday_id",
  "leave_type_id",
  "note",
];

// ================================================================ Client portal (hours only)
export type ClientTimesheetFlags = { ot_above_threshold: boolean; holiday_entries: boolean; above_daily_cap: boolean };

export type ClientTimesheetSummary = {
  id: string;
  human_id: string;
  placement_id: string;
  worker_name: string | null;
  role_title: string | null;
  kind: string;
  period_start: string;
  period_end: string;
  status: string;
  total_hours: string;
  totals: Record<string, string>;
  flags: ClientTimesheetFlags;
  approval_request_id: string | null;
  awaiting_client: boolean;
  submitted_at: string | null;
};

export type ClientTimesheetDay = { date: string; hours: Record<string, string>; total: string; day_comment: string | null };

export type ClientTimesheetDetail = ClientTimesheetSummary & {
  days: ClientTimesheetDay[];
  adjustment_deltas: ClientTimesheetDay[];
  rejection_comment: string | null;
};

export type ClientDecision = "approve" | "reject";
export type ClientDecideIn = { action: ClientDecision; comment?: string | null };
export type ClientBulkPreviewOut = {
  items: ClientTimesheetSummary[];
  not_decidable: string[];
  total_hours: string;
  preview_hash: string;
};
export type ClientBulkDecideIn = { timesheet_ids: string[]; action: ClientDecision; comment?: string | null; preview_hash: string };
export type ClientBulkDecideOut = { decided: string[]; skipped: { timesheet_id: string; code: string }[] };
