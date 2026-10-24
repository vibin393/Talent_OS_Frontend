/** Pure state helpers of the 5-step apply flow (Epic 9, story 9.2). */
import type { PublicApplyForm, PublicNotice, PublicPrefill } from "@/lib/api/types";

export const STEPS = ["Privacy", "Resume", "Your details", "Questions", "Review & submit"] as const;
export type StepIndex = 0 | 1 | 2 | 3 | 4;

export type Details = { full_name: string; email: string; phone: string; location: string; links: string };
export type DetailKey = keyof Details;
export const EMPTY_DETAILS: Details = { full_name: "", email: "", phone: "", location: "", links: "" };

/** DOM ids of the controls (error-summary links target these). */
export const FIELD_IDS = {
  dataConsent: "apply-consent-data",
  challenge: "apply-challenge",
  resume: "apply-resume",
  full_name: "apply-full-name",
  email: "apply-email",
  phone: "apply-phone",
  location: "apply-location",
  links: "apply-links",
} as const;

export function noticeFor(form: PublicApplyForm, purpose: string): PublicNotice | undefined {
  return form.notices.find((n) => n.purpose === purpose);
}

// ------------------------------------------------------------------ step 1: consent
export type ConsentState = { data: boolean; ai: boolean };

/** Errors for the privacy step; `challengeToken` is required unless the provider is `none`. */
export function validateConsent(form: PublicApplyForm, consent: ConsentState, challengeToken: string | null): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!noticeFor(form, "data_processing")) errors[FIELD_IDS.dataConsent] = "Applications are not open right now";
  else if (!consent.data) errors[FIELD_IDS.dataConsent] = "Agree to the processing of your data to apply";
  if (form.challenge.provider !== "none" && !challengeToken) errors[FIELD_IDS.challenge] = "Complete the security check";
  return errors;
}

/** Consent entries for `POST .../apply-sessions` (AI only when ticked and a notice exists). */
export function consentPayload(form: PublicApplyForm, consent: ConsentState): { purpose: "data_processing" | "ai_processing"; notice_id: string }[] {
  const out: { purpose: "data_processing" | "ai_processing"; notice_id: string }[] = [];
  const data = noticeFor(form, "data_processing");
  if (data && consent.data) out.push({ purpose: "data_processing", notice_id: data.id });
  const ai = noticeFor(form, "ai_processing");
  if (ai && consent.ai) out.push({ purpose: "ai_processing", notice_id: ai.id });
  return out;
}

// ------------------------------------------------------------------ step 2: resume
export const EXTENSIONS = [".pdf", ".doc", ".docx"];

/** `accepted_types` from the API ("pdf", ".docx", or a MIME type) as file extensions. */
export function acceptedExtensions(types: readonly string[] | undefined): string[] {
  const ext = (types ?? [])
    .filter((t) => !t.includes("/"))
    .map((t) => (t.startsWith(".") ? t : `.${t}`).toLowerCase());
  return ext.length ? ext : EXTENSIONS;
}

/** "PDF or DOCX" / "PDF, DOC or DOCX". */
export function extensionsLabel(ext: readonly string[]): string {
  const names = ext.map((e) => e.replace(/^\./, "").toUpperCase());
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

export function fileError(file: File | { name: string; size: number }, maxMb: number, extensions: readonly string[] = EXTENSIONS): string | null {
  const name = file.name.toLowerCase();
  if (!extensions.some((e) => name.endsWith(e))) return `Choose a ${extensionsLabel(extensions)} file`;
  if (file.size === 0) return "This file is empty";
  if (file.size > maxMb * 1024 * 1024) return `The file is larger than ${maxMb} MB`;
  return null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ------------------------------------------------------------------ step 3: details
/** Merge a resume prefill into the details: only empty fields are filled; returns the filled keys. */
export function applyPrefill(details: Details, prefill: PublicPrefill | null | undefined): { details: Details; filled: DetailKey[] } {
  if (!prefill) return { details, filled: [] };
  const next = { ...details };
  const filled: DetailKey[] = [];
  const offer = (key: DetailKey, value: string | null | undefined) => {
    const v = (value ?? "").trim();
    if (v && !next[key].trim()) {
      next[key] = v;
      filled.push(key);
    }
  };
  offer("full_name", prefill.full_name);
  offer("email", prefill.email);
  offer("phone", prefill.phone);
  offer("location", prefill.location);
  offer("links", (prefill.links ?? []).join("\n"));
  return { details: next, filled };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // NOSONAR
// E.164 ("+" and 8–15 digits) or a 10-digit Indian mobile number, ignoring spaces, dashes and brackets.
const PHONE_E164 = /^\+[1-9]\d{7,14}$/;
const PHONE_IN = /^(?:0|91)?[6-9]\d{9}$/;

export function isValidPhone(raw: string): boolean {
  const compact = raw.replace(/[\s\-().]/g, "");
  return PHONE_E164.test(compact) || PHONE_IN.test(compact);
}

export function linkList(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isValidUrl(raw: string): boolean {
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

export function validateDetails(details: Details, requiresPhone: boolean): Partial<Record<DetailKey, string>> {
  const errors: Partial<Record<DetailKey, string>> = {};
  if (!details.full_name.trim()) errors.full_name = "Enter your full name";
  else if (details.full_name.trim().length > 200) errors.full_name = "Keep your name under 200 characters";
  if (!details.email.trim()) errors.email = "Enter your email address";
  else if (!EMAIL.test(details.email.trim())) errors.email = "Enter an email address like name@example.com";
  if (!details.phone.trim()) {
    if (requiresPhone) errors.phone = "Enter your phone number";
  } else if (!isValidPhone(details.phone)) {
    errors.phone = "Enter a phone number with country code, like +91 98765 43210";
  }
  const links = linkList(details.links);
  if (links.length > 10) errors.links = "Add at most 10 links";
  else if (links.some((l) => !isValidUrl(l) || l.length > 500)) errors.links = "Check your links: each must be a web address";
  return errors;
}

// ------------------------------------------------------------------ draft (text only, never the file)
export type Draft = { details: Details; answers: Record<string, string> };

export function draftKey(slug: string, postingId: string): string {
  return `apply-draft:${slug}:${postingId}`;
}

export function loadDraft(key: string): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft>;
    const details = { ...EMPTY_DETAILS };
    for (const k of Object.keys(EMPTY_DETAILS) as DetailKey[]) {
      const v = parsed.details?.[k];
      if (typeof v === "string") details[k] = v;
    }
    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.answers ?? {})) if (typeof v === "string") answers[k] = v;
    return { details, answers };
  } catch {
    return null;
  }
}

export function saveDraft(key: string, draft: Draft): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // storage unavailable (private mode, quota): the draft is a convenience only
  }
}

export function clearDraft(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ------------------------------------------------------------------ session expiry
export const EXPIRY_WARNING_MS = 5 * 60 * 1000;

export function expiryState(expiresAt: string | null, now: number): "none" | "ok" | "warning" | "expired" {
  if (!expiresAt) return "none";
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return "none";
  if (now >= t) return "expired";
  return t - now <= EXPIRY_WARNING_MS ? "warning" : "ok";
}

// ------------------------------------------------------------------ API errors
export function applyErrorMessage(code: string, status: number, fallback: string): string {
  if (status === 429 || code === "rate_limited") return "Too many attempts, try again later.";
  switch (code) {
    case "challenge_failed":
      return "The security check failed. Please try it again.";
    case "consent_required":
      return "Agree to the processing of your data to apply.";
    case "notice_outdated":
      return "The privacy notice was just updated. Please review it and agree again.";
    case "file_infected":
      return "This file failed our security scan. Please upload a different file.";
    case "apply_session_expired":
    case "apply_session_not_found":
      return "Your application session has expired. Please start again; your answers are kept.";
    case "apply_session_submitted":
      return "This application was already submitted.";
    case "resume_required":
      return "Please upload your resume.";
    case "tenant_not_accepting":
    case "posting_not_found":
      return "This job is no longer accepting applications.";
    default:
      return fallback;
  }
}
