/**
 * Expenses (Epic 27) API types, hand-written from the backend contract. Every money / km / rate value is a
 * decimal STRING (AD-20) — never convert with parseFloat for sums or display (see `money.ts`).
 */

export const EXPENSE_CATEGORIES = ["travel", "accommodation", "meals", "mileage", "equipment", "other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const CLAIM_STATUSES = [
  "draft",
  "submitted",
  "in_approval",
  "approved",
  "partially_approved",
  "rejected",
  "reimbursed",
  "stated",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export type LineStatus = "pending" | "approved" | "rejected";

export const EXPENSE_FLAGS = [
  "over_daily_limit",
  "over_claim_limit",
  "receipt_missing",
  "possible_duplicate_receipt",
  "category_disabled",
] as const;
export type ExpenseFlag = (typeof EXPENSE_FLAGS)[number];

export type RebillMethod = "at_cost" | "markup" | "not_billable";
export type RebillTaxMode = "taxable" | "pure_agent";
export type Decision = "approve" | "reject";

// ---------------------------------------------------------------- lines (shared)
export type LineIn = {
  expense_date: string;
  category: ExpenseCategory;
  description?: string | null;
  amount?: string | null;
  currency?: string | null;
  km?: string | null;
  receipt_file_id?: string | null;
  billable?: boolean | null;
  reimbursable?: boolean;
  justification?: string | null;
};

export type LinePreviewOut = {
  amount: string | null;
  currency: string;
  km: string | null;
  fx_rate: string | null;
  fx_rate_date: string | null;
  amount_claim_ccy: string | null;
  claim_currency: string;
  billable: boolean;
  flags: string[];
  receipt_required: boolean;
  justification_required: boolean;
};

// ---------------------------------------------------------------- Worker portal
export type WorkerExpenseSettings = {
  ai_receipt_read_enabled: boolean;
  max_receipt_mb: number;
  allowed_receipt_types: string[];
};

export type WorkerClaimSummary = {
  id: string;
  human_id: string;
  placement_id: string;
  client_name: string | null;
  role_title: string | null;
  currency: string;
  title: string | null;
  status: ClaimStatus;
  submitted_at: string | null;
  total_claimed: string;
  total_approved: string | null;
  line_count: number;
};

export type ClaimablePlacement = {
  placement_id: string;
  client_name: string | null;
  role_title: string | null;
  currency: string;
  start_date: string | null;
  end_date: string | null;
};

export type WorkerLine = {
  id: string;
  expense_date: string;
  category: ExpenseCategory;
  description: string | null;
  amount: string;
  currency: string;
  km: string | null;
  fx_rate: string | null;
  fx_rate_date: string | null;
  amount_claim_ccy: string;
  receipt_file_id: string | null;
  receipt_name: string | null;
  billable: boolean;
  reimbursable: boolean;
  flags: string[];
  justification: string | null;
  line_status: LineStatus;
  decision_comment: string | null;
};

export type WorkerClaimOut = WorkerClaimSummary & {
  editable: boolean;
  can_recall: boolean;
  rejection_comment: string | null;
  placement_start: string | null;
  placement_end: string | null;
  lines: WorkerLine[];
};

export type ReceiptUploadOut = {
  file_id: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  scan_status: string;
};

export type ReceiptSuggestion = {
  expense_date: string | null;
  merchant: string | null;
  amount: string | null;
  currency: string | null;
  category: string | null;
};

export type ReceiptReadOut = { ok: boolean; suggestion: ReceiptSuggestion | null; error_code: string | null };

// ---------------------------------------------------------------- internal
export type ExpenseSettingsOut = {
  ai_receipt_read_enabled: boolean;
  duplicate_receipt_window_days: number;
  max_receipt_mb: number;
  allowed_receipt_types: string[];
};
export type ExpenseSettingsUpdate = Partial<Pick<ExpenseSettingsOut, "ai_receipt_read_enabled" | "duplicate_receipt_window_days" | "max_receipt_mb">>;

export type PolicyCategory = {
  category: ExpenseCategory;
  enabled: boolean;
  daily_limit: string | null;
  claim_limit: string | null;
  limit_currency: string;
  receipt_required_above: string | null;
  mileage_rate_per_km: string | null;
  default_billable: boolean;
  rebill_method: RebillMethod;
  markup_pct: string | null;
  rebill_tax_mode: RebillTaxMode;
};

export type PolicyVersionRef = { id: string; version: number; effective_from: string; superseded_at: string | null };

export type PolicyOut = {
  id: string;
  name: string;
  scope: "tenant" | "client";
  client_id: string | null;
  client_name: string | null;
  version: number;
  effective_from: string;
  superseded_at: string | null;
  created_at: string;
  categories: PolicyCategory[];
  versions: PolicyVersionRef[];
};

export type PolicyCreateIn = {
  name: string;
  scope: "tenant" | "client";
  client_id?: string | null;
  effective_from?: string | null;
  categories: PolicyCategory[];
};
export type PolicyVersionIn = { name?: string | null; effective_from?: string | null; categories: PolicyCategory[] };

export type ClaimSummaryOut = {
  id: string;
  human_id: string;
  placement_id: string;
  candidate_id: string | null;
  worker_name: string | null;
  client_id: string | null;
  client_name: string | null;
  legal_entity_id: string | null;
  currency: string;
  title: string | null;
  status: ClaimStatus;
  submitted_at: string | null;
  total_claimed: string;
  total_approved: string | null;
  line_count: number;
  flags: string[];
  is_proxy: boolean;
  unposted_lines: number;
};

export type LineDecisionOut = { step: string | number | null; decision: string; comment: string | null; actor_kind: string | null; decided_at: string | null };

export type ClaimLineOut = WorkerLine & {
  fx_source: string | null;
  rebill_method: RebillMethod | null;
  markup_pct: string | null;
  rebill_tax_mode: RebillTaxMode | null;
  bill_amount: string | null;
  payable_posted: boolean;
  billing_posted: boolean;
  decisions: LineDecisionOut[];
};

export type ApprovalHistoryOut = { name: string | null; outcome: string | null; actor_kind: string | null; comment: string | null; decided_at: string | null };

export type ClaimDetailOut = ClaimSummaryOut & {
  proxy_reason: string | null;
  rejection_comment: string | null;
  approval_request_id: string | null;
  current_step: string | null;
  approved_at: string | null;
  reimbursed_at: string | null;
  payroll_reference: string | null;
  stated_at: string | null;
  reopen_reason: string | null;
  locked: boolean;
  can_reopen: boolean;
  lines: ClaimLineOut[];
  approval_history: ApprovalHistoryOut[];
};

export type LineDecisionIn = { line_id: string; decision: Decision; comment?: string | null };
export type DecideIn = { action: Decision; comment?: string | null; line_decisions: LineDecisionIn[] };

export type ClaimFilters = {
  status?: string;
  placement_id?: string;
  client_id?: string;
  candidate_id?: string;
  flag?: string;
  date_from?: string;
  date_to?: string;
  unposted?: string;
};

// ---------------------------------------------------------------- Client portal
export type ClientClaimSummary = {
  id: string;
  human_id: string;
  placement_id: string;
  worker_name: string | null;
  role_title: string | null;
  currency: string;
  title: string | null;
  status: ClaimStatus;
  submitted_at: string | null;
  billable_line_count: number;
  billable_total: string | null;
  approval_request_id: string | null;
  awaiting_client: boolean;
};

export type ClientClaimLine = {
  id: string;
  expense_date: string;
  category: ExpenseCategory;
  description: string | null;
  amount_claim_ccy: string;
  bill_amount: string | null;
  has_receipt: boolean;
  line_status: LineStatus;
  decision_comment: string | null;
};

export type ClientClaimDetail = ClientClaimSummary & { lines: ClientClaimLine[]; line_decisions_supported: boolean };
