/** Legal Entities admin types (Epic 13 API + Epic 14 deltas). Hand-written until `npm run gen:api` runs. */
export type EntityStatus = "active" | "inactive";

export type LegalEntityOut = {
  id: string;
  name: string;
  legal_name: string;
  pan: string | null;
  cin: string | null;
  address: Record<string, unknown>;
  state_code: string | null;
  country: string;
  default_currency: string;
  timezone: string;
  logo_file_id: string | null;
  signatory_name: string | null;
  signatory_title: string | null;
  status: EntityStatus;
  is_backfilled: boolean;
  created_at: string;
  updated_at: string;
  deactivation_reason?: string | null;
  deactivated_at?: string | null;
};

export type LegalEntityIn = {
  name: string;
  legal_name: string;
  pan?: string | null;
  cin?: string | null;
  address?: Record<string, unknown>;
  state_code?: string | null;
  country?: string;
  default_currency?: string;
  timezone?: string;
  signatory_name?: string | null;
  signatory_title?: string | null;
};

export type LegalEntityUpdate = Partial<LegalEntityIn>;

export type ReadinessOut = { legal_entity_id: string; ready_for_invoicing: boolean; missing: string[] };

export type GstRegistrationOut = {
  id: string;
  legal_entity_id: string;
  gstin: string;
  state_code: string;
  address: Record<string, unknown>;
  is_principal: boolean;
  einvoice_applicable: boolean;
  irp_reporting_limit: boolean;
  status: EntityStatus;
  created_at: string;
};

export type GstRegistrationIn = {
  gstin: string;
  state_code: string;
  is_principal?: boolean;
  einvoice_applicable?: boolean;
  irp_reporting_limit?: boolean;
};

export type LutOut = {
  id: string;
  gst_registration_id: string;
  fiscal_year: string;
  lut_number: string;
  valid_from: string;
  valid_to: string;
};
export type LutPutIn = { lut_number: string; valid_from: string; valid_to: string };

export type BankAccountOut = {
  id: string;
  legal_entity_id: string;
  label: string;
  bank_name: string;
  account_number_last4: string;
  ifsc: string | null;
  swift: string | null;
  currency: string | null;
  is_default: boolean;
  created_at: string;
  branch?: string | null;
  account_name?: string | null;
  archived_at?: string | null;
};

export type BankAccountIn = {
  label: string;
  bank_name: string;
  account_number: string;
  ifsc?: string | null;
  swift?: string | null;
  currency?: string | null;
  is_default?: boolean;
  branch?: string | null;
  account_name?: string | null;
};

export type BankAccountUpdate = Partial<Omit<BankAccountIn, "account_number">> & {
  archived?: boolean;
  account_number?: string;
};

export type GstStateOut = { code: string; name: string; kind: string };
export type CurrencyOut = { code: string; name: string; document_allowed: boolean };

/** Document numbering series (`/legal-entities/{id}/document-series`). */
export type SeriesDocType = "invoice" | "credit_note" | "debit_note";
export type SeriesFyFormat = "YY-YY" | "YYYY-YY" | "YY" | "none";
export type SeriesSeparator = "/" | "-" | "";

export type DocumentSeriesOut = {
  id: string;
  legal_entity_id: string;
  gst_registration_id: string | null;
  doc_type: SeriesDocType;
  name: string;
  prefix: string;
  fy_format: SeriesFyFormat;
  separator: string;
  pad: number;
  is_legacy: boolean;
  allow_backdated: boolean;
  status: EntityStatus;
  next_number_preview?: string | null;
};

export type DocumentSeriesIn = {
  gst_registration_id?: string | null;
  doc_type: SeriesDocType;
  name: string;
  prefix?: string;
  fy_format?: SeriesFyFormat;
  separator?: SeriesSeparator;
  pad?: number;
  is_legacy?: boolean;
  allow_backdated?: boolean;
};

export type DocumentSeriesUpdate = Partial<Omit<DocumentSeriesIn, "gst_registration_id" | "doc_type" | "is_legacy">> & {
  status?: EntityStatus;
};
