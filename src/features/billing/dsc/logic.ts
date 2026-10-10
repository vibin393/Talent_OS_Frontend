/** Pure helpers for DSC signing (Epic 51). */
import { isApiError } from "@/lib/api/errors";
import type { DscPolicyIn, DscStatusValue } from "./types";

export type BadgeColor = "informative" | "warning" | "danger" | "success" | "subtle";

/** Queue age badge: > 72 h danger, > 24 h warning, otherwise informative. */
export function ageBadgeColor(ageHours: number): BadgeColor {
  if (ageHours > 72) return "danger";
  if (ageHours > 24) return "warning";
  return "informative";
}

/** "5 h" under two days, "3 d 4 h" beyond. */
export function formatAge(ageHours: number): string {
  const h = Math.max(0, Math.floor(ageHours));
  if (h < 48) return `${h} h`;
  const d = Math.floor(h / 24);
  const rest = h % 24;
  return rest ? `${d} d ${rest} h` : `${d} d`;
}

export const DSC_STATUS_BADGE: Record<DscStatusValue, { color: BadgeColor; label: string } | null> = {
  not_required: null,
  pending: { color: "warning", label: "Signature pending" },
  signed: { color: "success", label: "DSC signed" },
  failed: { color: "danger", label: "Signing failed" },
};

/** Undefined / unknown values (e.g. debit notes) are treated as not_required. */
export function normalizeDscStatus(v: string | null | undefined): DscStatusValue {
  return v === "pending" || v === "signed" || v === "failed" ? v : "not_required";
}

/** Friendly messages for DSC upload / signing / delivery errors. */
export const DSC_ERROR_MESSAGES: Record<string, string> = {
  dsc_content_mismatch:
    "The signed PDF does not match the invoice we rendered. Sign the exact file from \"Download PDF to sign\" without editing it.",
  dsc_signature_missing: "No digital signature was found in this PDF. Sign it with your DSC token and upload again.",
  dsc_signature_invalid: "The digital signature in this PDF is not valid. Re-sign the downloaded PDF and upload again.",
  dsc_not_pending: "This document is no longer waiting for a signature. Refresh the queue.",
  dsc_not_failed: "Only a failed signing request can be retried.",
  dsc_pending: "This document cannot be sent until it is DSC-signed.",
  dsc_policy_exists: "A DSC policy already exists for this GST registration and client.",
  unsupported_file_type: "Upload a PDF file.",
};

export const GENERIC_UPLOAD_ERROR = "The upload failed. Please try again.";

export function dscErrorMessage(e: unknown): string {
  const code = isApiError(e) ? e.code : typeof e === "string" ? e : "";
  return DSC_ERROR_MESSAGES[code] ?? GENERIC_UPLOAD_ERROR;
}

export type PolicyForm = {
  gst_registration_id: string;
  client_id: string | null;
  required: boolean;
  signer_ref: string;
  reason: string;
  location: string;
  active: boolean;
};

export const EMPTY_POLICY_FORM: PolicyForm = {
  gst_registration_id: "",
  client_id: null,
  required: true,
  signer_ref: "",
  reason: "",
  location: "",
  active: true,
};

/** Create body from the form (blank optional strings become null; reason left to the server default when blank). */
export function policyBody(f: PolicyForm): DscPolicyIn {
  const body: DscPolicyIn = {
    gst_registration_id: f.gst_registration_id,
    client_id: f.client_id,
    required: f.required,
    signer_ref: f.signer_ref.trim() || null,
    location: f.location.trim() || null,
    active: f.active,
  };
  if (f.reason.trim()) body.reason = f.reason.trim();
  return body;
}
