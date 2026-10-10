/** Billing & GST invoicing DTOs (Epic 29), hand-written to mirror `app/schemas/billing.py`. Money = decimal strings. */

export type DocKind = "invoice" | "credit_note" | "debit_note";
export type DocStatus =
  "draft" | "pending_approval" | "issued" | "discarded" | "cancelled";
export type EinvoiceStatus =
  "not_applicable" | "pending_irn" | "irn_registered" | "irn_cancelled";

export type TaxLineOut = {
  component: "cgst" | "sgst" | "utgst" | "igst";
  rate_pct: string;
  amount: string;
  charged: boolean;
  inr_amount: string;
};

export type DocLineOut = {
  id: string;
  line_no: number;
  line_kind: string;
  placement_id: string | null;
  po_id: string | null;
  description: string;
  sac_code: string;
  category: string | null;
  quantity: string;
  unit: string;
  rate: string;
  multiplier: string;
  effective_rate: string;
  gross_amount: string;
  discount_amount: string;
  taxable_value: string;
  outside_taxable_value: boolean;
  tax_rate_pct: string;
  inr_taxable_value: string;
  is_manual: boolean;
  period_start: string | null;
  period_end: string | null;
  original_invoice_line_id?: string | null;
  taxes: TaxLineOut[];
};

export type DocSummaryOut = {
  id: string;
  kind: DocKind;
  status: DocStatus;
  number: string | null;
  fiscal_year: string | null;
  doc_date: string | null;
  due_date: string | null;
  preview_date: string | null;
  client_id: string;
  legal_entity_id: string;
  supplier_gst_registration_id: string | null;
  currency: string;
  taxable_total: string;
  charged_tax_total: string;
  document_total: string;
  inr_document_total: string;
  supply_type: string | null;
  einvoice_status: EinvoiceStatus;
  delivery_status: "not_sent" | "sent" | "viewed";
  stale: boolean;
  approved: boolean;
  created_at: string;
  original_invoice_id?: string | null;
  invoice_run_id?: string | null;
  client_name?: string | null;
  /** Epic 51: DSC signing state (absent on debit notes = not_required). */
  dsc_status?: "not_required" | "pending" | "signed" | "failed";
};

export type DocDetailOut = DocSummaryOut & {
  recipient_snapshot: Record<string, unknown>;
  supplier_snapshot: Record<string, unknown>;
  pos_state_code: string | null;
  intra_state: boolean;
  reverse_charge: boolean;
  lut_ref: string | null;
  fx_rate: string | null;
  fx_source: string | null;
  fx_rate_date: string | null;
  outside_taxable_total: string;
  rcm_tax_total: string;
  round_off: string;
  inr_taxable_total: string;
  inr_tax_total: string;
  warnings: string[];
  notes: string | null;
  content_hash: string | null;
  issued_at: string | null;
  cancel_basis: string | null;
  cancelled_at: string | null;
  irn: string | null;
  ack_no: string | null;
  ack_at: string | null;
  signed_qr: string | null;
  irn_report_by: string | null;
  irn_cancelled_at: string | null;
  irn_cancel_reason: string | null;
  is_imported: boolean;
  reason?: string | null;
  rebill?: boolean | null;
  gst_adjusted?: boolean | null;
  amount_in_words: string;
  lines: DocLineOut[];
  irn_cancel_deadline?: string | null;
};

export type RunExceptionOut = {
  id: string;
  placement_id: string | null;
  client_id: string | null;
  kind: string;
  severity: "error" | "warning";
  details: Record<string, unknown>;
};

export type RunOut = {
  id: string;
  human_id: string;
  legal_entity_id: string;
  gst_registration_id: string | null;
  period_start: string;
  period_end: string;
  client_id: string | null;
  placement_ids: string[] | null;
  status: "queued" | "building" | "built" | "failed" | "discarded";
  progress_pct: number;
  draft_count: number;
  totals: Record<string, string>;
  error: string | null;
  created_at: string;
};

export type RunDetailOut = RunOut & {
  exceptions: RunExceptionOut[];
  drafts: DocSummaryOut[];
};

export type RunCreate = {
  legal_entity_id: string;
  gst_registration_id?: string | null;
  period_start: string;
  period_end: string;
  client_id?: string | null;
};

export type IssueResult = {
  id: string;
  ok: boolean;
  number: string | null;
  code: string | null;
  message: string | null;
};
export type IssueBatchOut = {
  issued: number;
  failed: number;
  results: IssueResult[];
};

export type CapComponent = {
  component: string;
  original: string;
  remaining: string;
};
export type LineCap = {
  line_id: string;
  line_no: number;
  description: string;
  effective_rate: string;
  quantity: string;
  original_taxable: string;
  remaining_taxable: string;
  remaining_quantity: string;
  components: CapComponent[];
};
export type NoteCapsOut = {
  invoice_id: string;
  currency: string;
  gst_deadline: string | null;
  deadline_passed: boolean;
  imported: boolean;
  lines: LineCap[];
};

export type NoteLineIn = {
  original_invoice_line_id: string;
  quantity?: string;
  amount?: string;
};
export type CreditNoteIn = {
  reason:
    | "rate_correction"
    | "hours_correction"
    | "discount"
    | "cancellation"
    | "commercial"
    | "other";
  full?: boolean;
  rebill?: boolean;
  gst_adjusted?: boolean;
  amount?: string;
  lines?: NoteLineIn[];
  notes?: string;
};
export type DebitNoteIn = {
  reason: "rate_correction" | "hours_correction" | "commercial" | "other";
  lines: NoteLineIn[];
  notes?: string;
};

export type IrnIn = {
  irn: string;
  ack_no: string;
  ack_at: string;
  signed_qr?: string;
};

export type ImportRowStatus =
  "matched" | "unmatched" | "already_registered" | "conflict" | "invalid";
export type EinvoiceImportRow = {
  gstin: string | null;
  doc_type: string | null;
  number: string | null;
  irn: string | null;
  ack_no: string | null;
  ack_at: string | null;
  status: ImportRowStatus;
  document_kind: DocKind | null;
  document_id: string | null;
  message: string | null;
};
export type EinvoiceImportOut = {
  batch_id: string;
  status: string;
  duplicate_of: string | null;
  counts: Partial<Record<ImportRowStatus, number>>;
  rows: EinvoiceImportRow[];
};

export type BillingSettingsOut = {
  round_off_mode: "none" | "nearest_rupee";
  cn_gst_deadline: string;
  allow_backdated_issue: boolean;
  stale_unbilled_days: number;
  pending_irn_alert_hours: number;
  annexure_enabled: boolean;
};
export type SacCodeOut = {
  id: string;
  code: string;
  description: string;
  default_for_line_kind: string[];
  active: boolean;
};
export type TaxRateOut = {
  id: string;
  sac_code: string;
  rate_pct: string;
  effective_from: string;
  effective_to: string | null;
};

export type ManualLineIn = {
  description: string;
  sac_code?: string;
  quantity?: string;
  unit?: string;
  rate: string;
  discount_amount?: string;
  pure_agent?: boolean;
};

export type PortalInvoiceSummary = {
  id: string;
  kind: DocKind;
  number: string | null;
  doc_date: string | null;
  due_date: string | null;
  currency: string;
  document_total: string;
  status: string;
  payment_status: string | null;
};
export type PortalInvoiceDetail = PortalInvoiceSummary & {
  taxable_total: string;
  tax_total: string;
  amount_in_words: string;
  irn: string | null;
  lines: {
    line_no: number;
    description: string;
    sac_code: string;
    quantity: string;
    unit: string;
    rate: string;
    taxable_value: string;
  }[];
};

/** The `draft_stale` 409 detail: `{field: {from, to}}`. */
export type StaleDiff = Record<string, { from: unknown; to: unknown }>;
