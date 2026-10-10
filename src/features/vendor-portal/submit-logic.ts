/**
 * Vendor submission form rules (Epic 17, FR-95): client-side validation mirrors the server, and every 409 / 422
 * code maps to copy. Rates are compared as Decimal strings (scaled BigInt), never as floats.
 */

/** Exact attestation shown next to the checkbox (the server stores its own copy with the submission). */
export const ATTESTATION_TEXT =
  "I confirm that the candidate has authorised us to represent them for this role, that the information and resume " +
  "are accurate, and that the candidate has been informed that their data will be shared with the hiring organisation.";

export type SubmitValues = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  experienceYears: string;
  noticeDays: string;
  availability: string;
  vendorRate: string;
  attestation: boolean;
  resume: File | null;
};

export const EMPTY_SUBMIT: SubmitValues = {
  fullName: "",
  email: "",
  phone: "",
  location: "",
  experienceYears: "",
  noticeDays: "",
  availability: "",
  vendorRate: "",
  attestation: false,
  resume: null,
};

const RATE_RE = /^\d{1,10}(\.\d{1,4})?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESUME_TYPES = [".pdf", ".docx"];
export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

/** Compare two non-negative Decimal strings: -1 / 0 / 1. */
export function compareDecimal(a: string, b: string): number {
  const scale = (v: string) => {
    const [i, f = ""] = v.split(".");
    return BigInt(i || "0") * BigInt(10000) + BigInt((f + "0000").slice(0, 4));
  };
  const x = scale(a.trim());
  const y = scale(b.trim());
  return x === y ? 0 : x < y ? -1 : 1;
}

/** Field errors keyed by field name (empty object = valid). */
export function validateSubmission(v: SubmitValues, maxRate: string | null): Partial<Record<keyof SubmitValues, string>> {
  const errors: Partial<Record<keyof SubmitValues, string>> = {};
  if (!v.fullName.trim()) errors.fullName = "Enter the candidate's full name";
  if (!EMAIL_RE.test(v.email.trim())) errors.email = "Enter a valid email address";
  if (v.experienceYears && !/^\d{1,2}(\.\d)?$/.test(v.experienceYears)) errors.experienceYears = "Enter years, e.g. 6 or 6.5";
  if (v.noticeDays && !/^\d{1,3}$/.test(v.noticeDays)) errors.noticeDays = "Enter days, e.g. 30";
  if (!RATE_RE.test(v.vendorRate.trim())) errors.vendorRate = "Enter your rate, e.g. 1300 or 1300.50";
  else if (maxRate && compareDecimal(v.vendorRate, maxRate) > 0) errors.vendorRate = `The rate is above the maximum (${maxRate})`;
  if (!v.attestation) errors.attestation = "Confirm the attestation to submit";
  if (v.resume) {
    const name = v.resume.name.toLowerCase();
    if (!RESUME_TYPES.some((ext) => name.endsWith(ext))) errors.resume = "Upload a PDF or Word (.docx) resume";
    else if (v.resume.size > MAX_RESUME_BYTES) errors.resume = "The resume is larger than 10 MB";
  }
  return errors;
}

/** Copy for every server error code of the submission endpoints. */
export const SUBMIT_ERROR_COPY: Record<string, string> = {
  vendor_rate_above_max: "Your rate is above the maximum for this release.",
  rate_unit_mismatch: "Quote the rate in the release's currency and unit.",
  attestation_required: "Confirm the attestation to submit.",
  vendor_limit_reached: "You have reached the submission limit for this release.",
  deadline_passed: "The submission deadline for this release has passed.",
  release_closed: "This release no longer accepts submissions.",
  vendor_not_active: "Your organisation is not active yet, so you cannot submit candidates.",
  file_rejected: "The resume could not be accepted. Upload a clean PDF or Word file.",
  invalid_email: "Enter a valid email address.",
  already_in_review: "This submission is already being reviewed and can no longer be withdrawn.",
  resume_locked: "The resume can no longer be replaced at this stage.",
  portal_permission_required: "You do not have access to this. Ask your account manager.",
  validation_failed: "Check the highlighted fields.",
};

export function submitErrorCopy(code: string | undefined, fallback: string): string {
  return (code && SUBMIT_ERROR_COPY[code]) || fallback;
}

/** Multipart body of `POST /vendor-portal/releases/{id}/submissions`. */
export function toFormData(v: SubmitValues, rateUnit: string | null, currency: string): FormData {
  const form = new FormData();
  form.set("full_name", v.fullName.trim());
  form.set("email", v.email.trim());
  form.set("vendor_rate", v.vendorRate.trim());
  form.set("attestation", v.attestation ? "true" : "false");
  form.set("currency", currency);
  if (rateUnit) form.set("rate_unit", rateUnit);
  if (v.phone.trim()) form.set("phone_e164", v.phone.trim());
  if (v.location.trim()) form.set("current_location", v.location.trim());
  if (v.experienceYears) form.set("total_experience_months", String(Math.round(Number(v.experienceYears) * 12)));
  if (v.noticeDays) form.set("notice_period_days", v.noticeDays);
  if (v.availability) form.set("availability_date", v.availability);
  if (v.resume) form.set("resume", v.resume);
  return form;
}
