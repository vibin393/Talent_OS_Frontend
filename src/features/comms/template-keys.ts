import { isApiError } from "@/lib/api/errors";
import type { EmailTemplateKey } from "@/lib/api/types";

export const TEMPLATE_KEYS: readonly EmailTemplateKey[] = [
  "submission",
  "interview_invite",
  "interview_reminder",
  "rejection",
  "offer",
  "application_confirmation",
  "ai_screening_invite",
  "client_feedback_request",
  "custom",
];

export const TEMPLATE_KEY_LABELS: Record<EmailTemplateKey, string> = {
  submission: "Submission",
  interview_invite: "Interview invite",
  interview_reminder: "Interview reminder",
  rejection: "Rejection",
  offer: "Offer",
  application_confirmation: "Application confirmation",
  ai_screening_invite: "AI screening invite",
  client_feedback_request: "Client feedback request",
  custom: "Custom",
};

export function templateKeyLabel(key: string): string {
  return TEMPLATE_KEY_LABELS[key as EmailTemplateKey] ?? key;
}

/** Languages the templates support at launch (the backend refuses others with `language_not_supported`). */
export const LANGUAGE_LABELS: Record<string, string> = { en: "English" };

export function languageLabel(code: string): string {
  return LANGUAGE_LABELS[code] ?? code.toUpperCase();
}

/**
 * Merge-field problems from a 422: `unknown_merge_field` lists `details.fields`; `malformed_merge_token`
 * has no field list. Returns null for any other error.
 */
export function mergeFieldError(e: unknown): { code: "unknown_merge_field" | "malformed_merge_token"; fields: string[] } | null {
  if (!isApiError(e) || e.status !== 422) return null;
  if (e.code === "unknown_merge_field") {
    const raw = e.details.fields;
    const fields = Array.isArray(raw) ? raw.filter((f): f is string => typeof f === "string") : [];
    return { code: e.code, fields };
  }
  if (e.code === "malformed_merge_token") return { code: e.code, fields: [] };
  return null;
}
