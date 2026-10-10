/**
 * Receivables types (Epic 30), hand-written to mirror `app/schemas/receivables.py`. Money is a decimal string.
 */

export type DocKind = "invoice" | "debit_note";
export type PaymentMode = "neft" | "rtgs" | "imps" | "upi" | "cheque" | "wire";
export type TdsKind = "income_tax" | "gst_tds";

export interface AllocationIn {
  document_kind: DocKind;
  document_id: string;
  amount: string;
}

export interface TdsIn {
  document_kind: DocKind;
  document_id: string;
  kind: TdsKind;
  section_id?: string | null;
  rate_pct?: string | null;
  amount: string;
}

export interface PaymentIn {
  legal_entity_id: string;
  client_id: string;
  payment_date: string;
  amount: string;
  currency: string;
  fx_rate?: string | null;
  mode: PaymentMode;
  reference?: string | null;
  receiving_bank_account_id?: string | null;
  notes?: string | null;
  allocations: "auto" | "none" | AllocationIn[];
  tds: TdsIn[];
}

export interface AllocationOut {
  id: string;
  source_kind: "payment" | "credit_note";
  payment_id: string | null;
  credit_note_id: string | null;
  document_kind: DocKind;
  document_id: string;
  document_number: string | null;
  allocation_date: string;
  amount: string;
  currency: string;
  inr_at_document: string;
  inr_at_payment: string;
  realized_fx: string;
  prior_period: boolean;
  reversed: boolean;
  reversal_date: string | null;
}

export interface TdsOut {
  id: string;
  legal_entity_id: string;
  client_id: string;
  payment_id: string | null;
  document_kind: DocKind;
  document_id: string;
  document_number: string | null;
  kind: TdsKind;
  section_code: string | null;
  rate_pct: string;
  base_amount: string;
  expected_amount: string;
  amount: string;
  currency: string;
  variance_flag: boolean;
  deduction_date: string;
  quarter: string;
  certificate_status: "expected" | "received" | "mismatch";
  certificate_ref: string | null;
  certificate_received_at: string | null;
  reversed: boolean;
}

export interface PaymentOut {
  id: string;
  human_id: string;
  legal_entity_id: string;
  client_id: string;
  payment_date: string;
  amount: string;
  currency: string;
  fx_rate: string | null;
  fx_source: string | null;
  inr_amount: string;
  mode: PaymentMode;
  reference: string | null;
  receiving_bank_account_id: string | null;
  allocation_status: "unallocated" | "partially_allocated" | "fully_allocated" | "reversed";
  reversed_at: string | null;
  reversal_reason: string | null;
  reversal_date: string | null;
  prior_period: boolean;
  unallocated: string;
  created_at: string;
}

export interface PaymentDetailOut extends PaymentOut {
  allocations: AllocationOut[];
  tds: TdsOut[];
}

export interface OpenDocumentOut {
  document_kind: DocKind;
  document_id: string;
  number: string | null;
  doc_date: string | null;
  due_date: string | null;
  currency: string;
  document_total: string;
  open_amount: string;
  disputed_amount: string;
  payment_status: string;
  taxable_excl_gst: string;
  expected_tds: string | null;
  tds_section_code: string | null;
  tds_rate_pct: string | null;
  gst_tds_applicable: boolean;
}

export interface TdsSectionOut {
  id: string;
  tenant_id: string | null;
  kind: TdsKind;
  code: string;
  label: string;
  default_rate_pct: string;
  certificate_name: string;
  active: boolean;
}

export interface TdsReceivableRow {
  client_id: string;
  quarter: string;
  kind: TdsKind;
  certificate_status: string;
  count: number;
  amount: string;
  currency: string;
}

export interface WriteOffRequestOut {
  id: string;
  legal_entity_id: string;
  client_id: string;
  document_kind: DocKind;
  document_id: string;
  currency: string;
  requested_amount: string;
  reason: string;
  status: "pending_approval" | "approved" | "rejected" | "executed" | "lapsed";
  status_reason: string | null;
  approval_request_id: string | null;
  write_off_id: string | null;
  created_at: string;
}

export interface DisputeOut {
  id: string;
  legal_entity_id: string;
  client_id: string;
  document_kind: DocKind;
  document_id: string;
  amount: string;
  currency: string;
  reason: string;
  owner_id: string | null;
  status: "open" | "resolved_credit_note" | "resolved_reissue" | "rejected";
  resolution_note: string | null;
  linked_credit_note_id: string | null;
  opened_at: string;
  resolved_at: string | null;
  age_days: number;
}

export interface AgingRow {
  key: string;
  label: string;
  client_id: string | null;
  document_kind: DocKind | null;
  document_id: string | null;
  due_date: string | null;
  currency: string;
  buckets: Record<string, string>;
  total_open: string;
  total_open_inr: string;
  disputed: string;
  unallocated_credit: string;
}

export interface AgingOut {
  as_of: string;
  legal_entity_id: string;
  group_by: "entity" | "client" | "document";
  bucket_labels: string[];
  rows: AgingRow[];
  totals_inr: Record<string, string>;
}

export interface DsoOut {
  legal_entity_id: string;
  period_start: string;
  period_end: string;
  dso: string | null;
  ar_open_inr: string;
  net_sales_inr: string;
}

export type ActivityKind = "call" | "email" | "meeting" | "note" | "promise_to_pay";

export interface ActivityIn {
  client_id: string;
  document_kind?: DocKind | null;
  document_id?: string | null;
  kind: ActivityKind;
  body?: string | null;
  ptp_amount?: string | null;
  ptp_currency?: string | null;
  ptp_date?: string | null;
}

export interface ActivityOut {
  id: string;
  client_id: string;
  document_kind: DocKind | null;
  document_id: string | null;
  kind: ActivityKind;
  body: string | null;
  ptp_amount: string | null;
  ptp_currency: string | null;
  ptp_date: string | null;
  ptp_status: "open" | "kept" | "broken" | null;
  owner_id: string | null;
  task_id: string | null;
  occurred_at: string;
  created_by: string | null;
}

export interface QueueRow {
  client_id: string;
  client_name: string | null;
  document_kind: DocKind;
  document_id: string;
  number: string | null;
  due_date: string | null;
  days_overdue: number;
  currency: string;
  open_amount: string;
  disputed_amount: string;
  collectible: string;
  do_not_remind: boolean;
  open_ptp_date: string | null;
}

export interface CollectionSettingsOut {
  client_id: string;
  do_not_remind: boolean;
  owner_id: string | null;
}

export interface ReminderOut {
  sent: string[];
  skipped: { document_id: string; reason: string }[];
}

export interface StatementLine {
  date: string;
  kind: string;
  reference: string | null;
  description: string;
  debit: string;
  credit: string;
  balance: string;
}

export interface StatementOut {
  client_id: string;
  legal_entity_id: string | null;
  currency: string;
  start: string;
  end: string;
  opening_balance: string;
  closing_balance: string;
  lines: StatementLine[];
}

export interface BankRowOut {
  id: string;
  row_no: number;
  date: string | null;
  amount: string | null;
  currency: string;
  reference: string | null;
  narrative: string | null;
  match_kind: "matched" | "unmatched" | "soft_duplicate" | "applied" | "failed";
  matched_document_ids: string[];
  client_id: string | null;
  soft_duplicate_of: string | null;
  payment_id: string | null;
  error: string | null;
}

export interface BankImportOut {
  batch_id: string;
  status: string;
  legal_entity_id: string;
  rows: BankRowOut[];
}

export interface ExportOut {
  id: string;
  legal_entity_id: string;
  from_date: string;
  to_date: string;
  template_id: string | null;
  format: "csv" | "xlsx";
  version: number;
  status: string;
  row_count: number;
  flagged_count: number;
  error: string | null;
  created_at: string;
}

export interface ExportTemplateOut {
  id: string;
  name: string;
  columns: string[];
  account_map: Record<string, string>;
  active: boolean;
}

export interface CheckResultOut {
  name: string;
  label: string;
  severity: "blocker" | "warning";
  count: number;
  link_path: string | null;
}

export interface PeriodOut {
  id: string;
  legal_entity_id: string;
  year: number;
  month: number;
  status: "open" | "closed";
  closed_at: string | null;
  reopened_count: number;
  pending_reopen: boolean;
}

export interface CloseEventOut {
  id: string;
  accounting_period_id: string;
  legal_entity_id: string;
  year: number;
  month: number;
  action: string;
  actor_kind: string;
  actor_id: string | null;
  reason: string | null;
  request_status: string | null;
  approval_request_id: string | null;
  at: string;
}

export interface ReconRunOut {
  id: string;
  as_of: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  findings_count: number;
  error: string | null;
}

export interface ReconFindingOut {
  id: string;
  run_id: string;
  check: string;
  severity: "error" | "warning";
  subject_kind: string;
  subject_id: string | null;
  details: Record<string, unknown>;
}

export interface PortalPaymentStatus {
  document_kind: DocKind;
  document_id: string;
  open_amount: string;
  payment_status: string;
  due_date: string | null;
}
