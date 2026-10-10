/** DSC-signed invoices (Epic 51 Part A1/B). Hand-written: `gen:api` is not run for this epic. */

export type DscKind = "invoice" | "credit_note";
export type DscStatusValue = "not_required" | "pending" | "signed" | "failed";

export type DscPolicy = {
  id: string;
  gst_registration_id: string;
  /** null = every client of that registration. */
  client_id: string | null;
  required: boolean;
  provider_config_id: string | null;
  signer_ref: string | null;
  reason: string;
  location: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type DscPolicyIn = {
  gst_registration_id: string;
  client_id?: string | null;
  required?: boolean;
  provider_config_id?: string | null;
  signer_ref?: string | null;
  reason?: string;
  location?: string | null;
  active?: boolean;
};

export type DscPolicyUpdate = Partial<Omit<DscPolicyIn, "gst_registration_id" | "client_id">>;

export type DscPending = {
  request_id: string;
  kind: DscKind;
  doc_id: string;
  number: string | null;
  client_id: string;
  client_name: string | null;
  status: "pending" | "failed";
  age_hours: number;
  adapter_key: string;
  attempts: number;
  last_error: string | null;
  requested_at: string;
};

export type DscStatus = {
  kind: DscKind;
  doc_id: string;
  dsc_status: DscStatusValue;
  required: boolean;
  request_status: "pending" | "signed" | "failed" | null;
  adapter_key: string | null;
  attempts: number;
  last_error: string | null;
  requested_at: string | null;
  signed_at: string | null;
  signer_subject: string | null;
  signer_serial: string | null;
  signing_time: string | null;
  signed_pdf_file_id: string | null;
  render_sha256: string | null;
};

export type DscVerification = {
  intact: boolean;
  valid: boolean;
  trusted: "unknown";
  sub_filter: string | null;
  signer_subject: string | null;
  signer_serial: string | null;
  signing_time: string | null;
  warnings: string[];
};

export type DscUploadResult = { status: DscStatus; verification: DscVerification };
