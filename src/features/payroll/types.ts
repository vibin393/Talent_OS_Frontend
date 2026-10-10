/** Payroll Export DTOs (Epic 28), hand-written against `app/schemas/payroll.py`. Decimals are strings. */

export type PeriodStatus = "open" | "locked";
export type VersionKind = "preview" | "final" | "supplementary";
export type VersionStatus = "building" | "generated" | "finalized" | "processed" | "superseded";
export type FileFormat = "csv" | "xlsx";
export type LateItemMapping = "item_date" | "approval_date";
export type PayrollWorkerType = "employee" | "contractor";

export type PayrollSettingsOut = { late_item_mapping: LateItemMapping; include_worker_types: PayrollWorkerType[] };
export type PayrollSettingsUpdate = Partial<PayrollSettingsOut>;

export type PayCalendarOut = {
  id: string | null;
  legal_entity_id: string;
  frequency: "monthly";
  cutoff_day: number | "last";
  active: boolean;
  timezone: string;
};
export type PayCalendarIn = { cutoff_day: number | "last"; active: boolean; generate_from?: string | null };

export type PayPeriodOut = {
  id: string;
  human_id: string;
  legal_entity_id: string;
  period_start: string;
  period_end: string;
  status: PeriodStatus;
  locked_at: string | null;
  reopened_count: number;
  last_reopen_reason: string | null;
  final_count: number;
  supplementary_count: number;
  processed: boolean;
};

export type ExceptionKind = "unapproved_timesheets" | "missing_pay_rate" | "missing_bank_details" | "currency_mismatch";

export type ExceptionItem = {
  kind: ExceptionKind;
  candidate_id?: string | null;
  placement_id?: string | null;
  source_kind?: string | null;
  source_id?: string | null;
  timesheet_id?: string | null;
  label?: string | null;
  detail?: Record<string, unknown>;
};

export type ExceptionsOut = {
  pay_period_id: string;
  blocking: boolean;
  counts: Record<ExceptionKind, number>;
  unapproved_timesheets: ExceptionItem[];
  missing_pay_rate: ExceptionItem[];
  missing_bank_details: ExceptionItem[];
  currency_mismatch: ExceptionItem[];
};

export type CurrencyTotals = { gross_earnings_inputs: string; reimbursements_total: string; workers: string };

export type VersionOut = {
  id: string;
  human_id: string;
  pay_period_id: string;
  legal_entity_id: string;
  kind: VersionKind;
  supplementary: boolean;
  seq: number;
  status: VersionStatus;
  based_on_preview_id: string | null;
  exclude_exceptions: boolean;
  generated_at: string | null;
  finalized_at: string | null;
  items_hash: string | null;
  content_hash: string | null;
  exceptions: Record<string, ExceptionItem[]>;
  totals: Record<string, CurrencyTotals>;
  row_count: number;
  item_count: number;
  provider_status: string;
  provider_reference: string | null;
  processed_at: string | null;
};

export type RowOut = {
  id: string;
  candidate_id: string;
  worker_human_id: string | null;
  worker_name: string | null;
  placement_ids: string[];
  worker_type: string | null;
  pan_last4: string | null;
  bank_last4: string | null;
  ifsc: string | null;
  currency: string;
  hours_regular: string;
  hours_ot: string;
  hours_double_time: string;
  hours_holiday: string;
  hours_leave_paid: string;
  hours_leave_unpaid: string;
  days_leave_paid: string;
  days_leave_unpaid: string;
  earnings_regular: string;
  earnings_ot: string;
  earnings_double_time: string;
  earnings_holiday: string;
  earnings_leave_paid: string;
  earnings_base: string;
  pay_rates: Record<string, string>;
  reimbursements_total: string;
  adjustments_total: string;
  rate_adjustments_total: string;
  gross_earnings_inputs: string;
};

export type ItemOut = {
  id: string;
  source_kind: string;
  source_id: string | null;
  placement_id: string | null;
  bucket: string;
  category: string | null;
  item_date: string;
  quantity: string;
  rate: string | null;
  multiplier: string | null;
  amount: string;
  currency: string;
};

export type MappingColumn = { source_field: string; header: string; include: boolean };
export type MappingOut = {
  id: string;
  legal_entity_id: string | null;
  name: string;
  format: FileFormat;
  columns: MappingColumn[];
  is_default: boolean;
};
export type MappingIn = {
  name: string;
  legal_entity_id?: string | null;
  format: FileFormat;
  columns: MappingColumn[];
  is_default?: boolean;
};
export type MappingUpdate = Partial<Omit<MappingIn, "legal_entity_id">>;
export type CatalogueField = { key: string; label: string; identity: boolean; placeholder: boolean };

export type PayrollConnectorOut = { legal_entity_id: string; provider_key: string; config_id: string | null };
