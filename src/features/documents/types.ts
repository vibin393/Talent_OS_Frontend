/**
 * Epic 22 (Documents & eSignature) API types, hand-written from `app/schemas/documents.py`
 * (regenerate `schema.d.ts` with `npm run gen:api` against a running backend to cross-check).
 */

export type TemplateKind =
  | "employment_agreement"
  | "contractor_agreement"
  | "nda"
  | "policy"
  | "offer_letter"
  | "extension_letter"
  | "relieving_letter"
  | "experience_letter"
  | "client_form"
  | "other";

export type AccessLevel = "entity" | "hr" | "finance";
export type SignerRoleKind = "worker" | "tenant_signatory" | "client" | "vendor";
export type SignerKind = "candidate" | "user" | "client_user" | "contact" | "vendor_user";

export type SignerRole = { role: SignerRoleKind; order: number; label: string };

export type TemplateVersionStatus = "draft" | "published" | "retired";

export type TemplateVersionOut = {
  id: string;
  template_id: string;
  version_no: number;
  body_md: string;
  merge_fields: string[];
  status: TemplateVersionStatus | string;
  published_at: string | null;
  created_at: string;
};

export type TemplateOut = {
  id: string;
  name: string;
  kind: TemplateKind | string;
  legal_entity_id: string | null;
  signer_roles: SignerRole[];
  esign_config_id: string | null;
  current_version_id: string | null;
  current_version_no: number | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  versions: TemplateVersionOut[];
};

export type TemplateCreateIn = {
  name: string;
  kind: TemplateKind;
  legal_entity_id?: string | null;
  signer_roles?: SignerRole[];
  esign_config_id?: string | null;
  body_md?: string;
};

export type TemplatePatchIn = {
  name?: string;
  legal_entity_id?: string | null;
  signer_roles?: SignerRole[];
  esign_config_id?: string | null;
  archived?: boolean;
};

export type MergeCatalogue = { namespaces: Record<string, string[]>; filters: string[] };

export type DocumentVersionSource = "upload" | "generated" | "signed" | "migrated";

export type DocumentVersionOut = {
  id: string;
  version_no: number;
  sha256: string;
  size: number;
  source: DocumentVersionSource | string;
  file_name: string | null;
  content_type: string | null;
  template_version_id: string | null;
  signature_request_id: string | null;
  created_by_kind: string;
  created_by_id: string | null;
  created_at: string;
  download_url: string;
};

export type DocumentOut = {
  id: string;
  human_id: string;
  owner_kind: string;
  owner_id: string;
  category: string;
  title: string;
  access_level: AccessLevel | string;
  retention_class: string | null;
  expires_on: string | null;
  signed: boolean;
  superseded_by_id: string | null;
  archived_at: string | null;
  note: string | null;
  current_version: DocumentVersionOut | null;
  versions?: DocumentVersionOut[] | null;
  created_at: string;
  updated_at: string;
};

export type DocumentUploadIn = {
  owner_kind: string;
  owner_id: string;
  category: string;
  file: File;
  title?: string;
  access_level: AccessLevel;
  expires_on?: string | null;
};

export type DocumentPatchIn = {
  category?: string;
  title?: string;
  expires_on?: string | null;
  clear_expiry?: boolean;
  access_level?: AccessLevel;
};

export type SignatureRequestStatus = "draft" | "sent" | "partially_signed" | "completed" | "declined" | "expired" | "cancelled";
export type SignerStatus = "pending" | "notified" | "signed" | "declined" | "void";

export type SignerOut = {
  id: string;
  order: number;
  kind: SignerKind | string;
  principal_id: string | null;
  name: string;
  email: string;
  status: SignerStatus | string;
  notified_at: string | null;
  signed_at: string | null;
};

export type SignatureEventOut = { kind: string; signer_id: string | null; at: string; data: Record<string, unknown> };

export type SignatureRequestOut = {
  id: string;
  human_id: string;
  title: string;
  status: SignatureRequestStatus | string;
  document_id: string;
  document_version_id: string;
  subject_kind: string;
  subject_id: string;
  provider: string;
  doc_sha256: string | null;
  final_sha256: string | null;
  final_version_id: string | null;
  certificate_id: string;
  require_otp: boolean;
  expires_at: string;
  sent_at: string | null;
  completed_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  signers: SignerOut[];
  events: SignatureEventOut[];
};

export type SignerIn = {
  kind: SignerKind;
  principal_id?: string | null;
  contact_id?: string | null;
  email?: string | null;
  name?: string | null;
};

export type SignatureRequestIn = {
  template_id?: string | null;
  document_version_id?: string | null;
  merge_refs?: Record<string, string>;
  merge_data?: Record<string, unknown> | null;
  owner: { kind: string; id: string };
  subject?: { kind: string; id: string } | null;
  title?: string | null;
  signers: SignerIn[];
  expires_in_days: number;
  send: boolean;
};

/** One row of `GET /documents/signers/mine`. */
export type MySignature = {
  signer_id: string;
  request_id: string;
  human_id: string;
  title: string;
  status: string;
  signer_status: string;
  expires_at: string;
};

/** One row of `GET /portal/work/signatures`. */
export type PortalSignature = {
  request_id: string;
  signer_id: string;
  human_id: string;
  title: string;
  status: string;
  signer_status: string;
  your_turn: boolean;
  expires_at: string;
  completed_at: string | null;
  final_available: boolean;
};

export type CeremonySigner = { order: number; name: string; status: string; signed_at: string | null };

/** What a signer sees during the signing ceremony (never other signers' emails). */
export type CeremonyOut = {
  request_id: string;
  signer_id: string;
  human_id: string;
  title: string;
  tenant_name: string | null;
  status: SignatureRequestStatus | string;
  signer_name: string;
  signer_status: SignerStatus | string;
  your_turn: boolean;
  require_otp: boolean;
  consented: boolean;
  otp_verified: boolean;
  expires_at: string;
  doc_sha256: string | null;
  final_sha256: string | null;
  signers: CeremonySigner[];
  document_url: string;
};

export type OtpSentOut = { sent: boolean; expires_at: string; email_hint: string };
export type CeremonyActionOut = { status: string; request_status: string };
export type SignIn = { typed_name: string; otp?: string; agreed: boolean };

export type VerifyMatch = "final" | "original" | "none";
export type VerifyOut = {
  match: VerifyMatch;
  request_id?: string | null;
  human_id?: string | null;
  status?: string | null;
  completed_at?: string | null;
  signers: { name: string; signed_at: string | null }[];
};

export type PublicVerifyOut = { valid: boolean; title: string | null; completed_at: string | null; signer_count: number };

/** Minimal shapes of shared lists used by the template editor. */
export type LegalEntityOption = { id: string; name: string; is_active?: boolean };
export type EsignConfigOption = { id: string; display_name: string; provider_key: string; status: string; legal_entity_id: string | null };
