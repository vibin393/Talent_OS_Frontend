/**
 * Client commercials API types (Epic 16), hand-written to mirror `Backend/app/schemas/commercials.py`
 * (no backend was running for `npm run gen:api`). Money / decimal fields are strings (AD-20); ids are UUID
 * strings; dates are ISO strings.
 */

export type Money = { amount: string; currency: string };

// ---------------------------------------------------------------- payment terms / settings
export type PaymentTermOut = { id: string; name: string; days: number; is_default: boolean; archived_at: string | null };
export type PaymentTermIn = { name: string; days: number; is_default?: boolean };
export type PaymentTermUpdate = Partial<PaymentTermIn>;

export type ApprovalStep = { name?: string; approver_kind: string; approver_ref: Record<string, unknown> };
export type CommercialsSettingsOut = {
  contract_renewal_lead_days: number[];
  po_alert_thresholds_pct: number[];
  po_expiry_alert_days: number;
  rate_exception_steps: ApprovalStep[];
  po_exception_steps: ApprovalStep[];
};
export type CommercialsSettingsUpdate = Partial<CommercialsSettingsOut>;

// ---------------------------------------------------------------- billing profile
export type TaxTreatment = "registered" | "unregistered" | "sez" | "export";
export type DeliveryPreference = "email" | "portal" | "email_and_portal";
export type PreferredVendorStatus = "none" | "empanelled" | "preferred";

export type BillingProfileIn = {
  legal_name: string;
  pan?: string | null;
  tax_treatment: TaxTreatment;
  payment_terms_id?: string | null;
  po_required: boolean;
  delivery_preference: DeliveryPreference;
  tds_section_code?: string | null;
  tds_rate_pct?: string | null;
  gst_tds_applicable: boolean;
  preferred_vendor_status: PreferredVendorStatus;
  msp_name?: string | null;
  vms_name?: string | null;
  vms_reference?: string | null;
};

export type BillingAddressIn = {
  label: string;
  line1: string;
  line2?: string | null;
  city: string;
  state_code?: string | null;
  postal_code?: string | null;
  country: string;
  gstin?: string | null;
  is_sez: boolean;
  is_default: boolean;
};
export type BillingAddressOut = BillingAddressIn & {
  id: string;
  client_id: string;
  billing_profile_id: string;
  archived_at: string | null;
};
export type BillingContactOut = { contact_id: string; role: "to" | "cc"; name: string; email: string | null };
export type BillingProfileOut = BillingProfileIn & {
  id: string;
  client_id: string;
  addresses: BillingAddressOut[];
  contacts: BillingContactOut[];
  complete: boolean;
};

// ---------------------------------------------------------------- contracts
export type ContractType = "msa" | "sow" | "amendment" | "vendor_agreement";
export type ContractStatus = "draft" | "pending_approval" | "active" | "expired" | "terminated";
export type ConversionFeeKind = "none" | "pct_of_ctc" | "fixed";

export type ContractRef = {
  id: string;
  human_id: string;
  contract_type: ContractType;
  title: string | null;
  status: ContractStatus;
  start_date: string;
  end_date: string | null;
};

export type ContractCreate = {
  contract_type: ContractType;
  client_id?: string | null;
  vendor_id?: string | null;
  legal_entity_id: string;
  parent_contract_id?: string | null;
  title: string;
  start_date: string;
  end_date?: string | null;
  amends_end_date?: string | null;
  value_cap?: string | null;
  currency: string;
  payment_terms_id?: string | null;
  conversion_fee_kind?: ConversionFeeKind;
  conversion_fee_value?: string | null;
  conversion_fee_waive_after_months?: number | null;
  placement_fee_pct?: string | null;
  reverse_charge?: boolean;
  share_bgv_outcome?: boolean;
  notice_period_days?: number | null;
  renewal_lead_days?: number[] | null;
  owner_id?: string | null;
  /** Epic 45: SOWs only (required with `value_cap` = "Total value" before submit / activate). */
  pricing_model?: PricingModel | null;
};

/** Epic 45: SOW pricing model. */
export type PricingModel = "time_and_materials" | "fixed_price" | "milestone";

export type ContractOut = ContractRef & {
  counterparty_kind: "client" | "vendor";
  /** Epic 45: SOWs only. */
  pricing_model?: PricingModel | null;
  client_id: string | null;
  vendor_id: string | null;
  legal_entity_id: string;
  parent_contract_id: string | null;
  amends_end_date: string | null;
  value_cap: string | null;
  currency: string;
  payment_terms_id: string | null;
  conversion_fee_kind: ConversionFeeKind;
  conversion_fee_value: string | null;
  conversion_fee_waive_after_months: number | null;
  placement_fee_pct: string | null;
  reverse_charge: boolean;
  share_bgv_outcome: boolean;
  notice_period_days: number | null;
  renewal_lead_days: number[] | null;
  owner_id: string | null;
  approval_request_id: string | null;
  approved_at: string | null;
  signed_file_id: string | null;
  signature_request_id: string | null;
  activated_at: string | null;
  terminated_at: string | null;
  termination_date: string | null;
  termination_reason: string | null;
  created_at: string;
  updated_at: string;
  approval_chain_configured: boolean;
  children: ContractRef[];
};

export type ContractDocumentKind = "draft" | "signed" | "annex" | "other";
export type ContractDocumentOut = {
  id: string;
  contract_id: string;
  file_id: string;
  kind: ContractDocumentKind;
  uploaded_by: string | null;
  created_at: string;
  file_name: string | null;
};
export type ContractHistoryItem = { id: string; occurred_at: string; body: string; data: Record<string, unknown> | null; author_id: string | null };

export type MilestoneOut = {
  id: string;
  contract_id: string;
  name: string;
  amount: Money;
  due_date: string | null;
  status: "planned" | "accepted" | "cancelled";
  accepted_at: string | null;
  accepted_by: string | null;
  billed: boolean;
};
export type MilestoneIn = { name: string; amount: string; due_date?: string | null };

// ---------------------------------------------------------------- rate cards
export type RateUnit = "hour" | "day" | "month" | "year" | "fixed";
export type RateCardStatus = "draft" | "published" | "superseded" | "archived";
export type RateCardLine = {
  id?: string;
  role: string;
  location: string | null;
  experience_min_years: string | null;
  experience_max_years: string | null;
  min_bill_rate: string;
  max_bill_rate: string;
  currency: string;
  rate_unit: RateUnit;
  max_vendor_rate: string | null;
  markup_pct: string | null;
};
export type RateCardOut = {
  id: string;
  human_id: string;
  client_id: string | null;
  contract_id: string | null;
  is_template: boolean;
  name: string;
  version: number;
  status: RateCardStatus;
  effective_from: string | null;
  effective_to: string | null;
  source_template_id: string | null;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
  line_count: number;
  lines: RateCardLine[] | null;
};
export type RateCardIn = { client_id: string; contract_id?: string | null; name: string; effective_from: string };
export type ImportRowError = { row: number; field: string | null; code: string; message: string };
export type RateCardImportOut = { applied: number; errors: ImportRowError[]; duplicate: boolean };

// ---------------------------------------------------------------- rate checks
export type RateCheckSubjectKind = "demand" | "vendor_release" | "submission" | "offer" | "placement" | "extension" | "rate_segment";
export type RateCheckResultCode = "ok" | "out_of_range" | "no_matching_line" | "vendor_rate_exceeded" | "not_validated";
export type RateCheckRequest = {
  subject_kind: RateCheckSubjectKind;
  subject_id: string | null;
  client_id: string;
  contract_id?: string | null;
  on_date: string;
  role?: string | null;
  location?: string | null;
  experience_years?: string | null;
  bill_rate?: string | null;
  vendor_rate?: string | null;
  currency: string;
  rate_unit: string;
};
export type RateCheckPreviewOut = {
  result: RateCheckResultCode;
  status: "not_applicable" | "within" | "outside" | "no_match";
  requires_exception: boolean;
  rate_card_id: string | null;
  matched_line_id: string | null;
  min_bill_rate: string | null;
  max_bill_rate: string | null;
  max_vendor_rate: string | null;
};
export type RateCheckOut = {
  id: string;
  subject_kind: RateCheckSubjectKind;
  subject_id: string;
  input: Record<string, string | null>;
  result: RateCheckResultCode;
  min_bill_rate: string | null;
  max_bill_rate: string | null;
  approval_request_id: string | null;
  exception_status: "none" | "pending" | "approved" | "rejected";
  checked_at: string;
};

// ---------------------------------------------------------------- purchase orders
export type PoStatus = "active" | "expired" | "closed" | "cancelled";
export type PoValidityState = "upcoming" | "valid" | "expired";
export type PurchaseOrderIn = {
  client_id: string;
  legal_entity_id: string;
  contract_id?: string | null;
  po_number: string;
  currency: string;
  value_cap?: string | null;
  hours_cap?: string | null;
  valid_from: string;
  valid_to: string;
  owner_id?: string | null;
  alert_thresholds_pct?: number[] | null;
  notes?: string | null;
};
export type PurchaseOrderUpdate = Partial<Omit<PurchaseOrderIn, "client_id" | "legal_entity_id" | "po_number" | "currency">>;
export type PurchaseOrderOut = Required<Omit<PurchaseOrderIn, "owner_id" | "notes">> & {
  id: string;
  status: PoStatus;
  owner_id: string | null;
  file_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  consumed_amount: string;
  consumed_hours: string;
  remaining_amount: string | null;
  remaining_hours: string | null;
  pct_used: string | null;
  validity: PoValidityState;
};
export type PoConsumptionOut = {
  id: string;
  po_id: string;
  source_doc_kind: "invoice" | "credit_note" | "debit_note";
  source_doc_id: string;
  amount: string;
  hours: string;
  currency: string;
  exception_approval_id: string | null;
  recorded_at: string;
};
export type PoPlacementOut = { placement_id: string; human_id: string | null; status: string | null };

export type LegalEntityOption = { id: string; name: string };
