/**
 * Apply / screening questions (Epic 6 question schema): text drafts in the form, typed answers on submit.
 * Mirrors the backend `normalize_answers` rules so errors show before the round trip.
 */
import type { PublicApplyQuestion } from "@/lib/api/types";

export type AnswerDrafts = Record<string, string>;

export const RATING_VALUES = ["1", "2", "3", "4", "5"] as const;

/** DOM id of a question's control (error summary links point here). */
export function questionFieldId(key: string): string {
  return `q-${key}`;
}

function isBlank(v: string | undefined): boolean {
  return v === undefined || v.trim() === "";
}

/** Field errors keyed by question key (empty object when valid). */
export function validateAnswers(questions: readonly PublicApplyQuestion[], drafts: AnswerDrafts): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const q of questions) {
    const v = drafts[q.key];
    if (isBlank(v)) {
      if (q.required) errors[q.key] = "Answer this question";
      continue;
    }
    const value = (v as string).trim();
    switch (q.type) {
      case "number":
      case "money": {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0) errors[q.key] = q.type === "money" ? "Enter an amount" : "Enter a number";
        break;
      }
      case "rating":
        if (!RATING_VALUES.includes(value as (typeof RATING_VALUES)[number])) errors[q.key] = "Choose a rating from 1 to 5";
        break;
      case "boolean":
        if (value !== "yes" && value !== "no") errors[q.key] = "Choose yes or no";
        break;
      case "choice":
        if (!(q.options ?? []).includes(value)) errors[q.key] = "Choose one of the options";
        break;
      case "date":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) errors[q.key] = "Enter a date";
        break;
      default:
        if (value.length > 4000) errors[q.key] = "Keep your answer under 4000 characters";
    }
  }
  return errors;
}

/** Typed answers for the API (blank answers omitted). Call after `validateAnswers` passed. */
export function answersPayload(questions: readonly PublicApplyQuestion[], drafts: AnswerDrafts): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const q of questions) {
    const v = drafts[q.key];
    if (isBlank(v)) continue;
    const value = (v as string).trim();
    switch (q.type) {
      case "number":
      case "rating":
        out[q.key] = Number(value);
        break;
      case "money":
        out[q.key] = { amount: value, currency: null };
        break;
      case "boolean":
        out[q.key] = value === "yes";
        break;
      default:
        out[q.key] = value;
    }
  }
  return out;
}

/** Human-readable answer for a review screen. */
export function answerDisplay(q: PublicApplyQuestion, draft: string | undefined): string {
  if (isBlank(draft)) return "Not answered";
  const v = (draft as string).trim();
  if (q.type === "boolean") return v === "yes" ? "Yes" : "No";
  if (q.type === "rating") return `${v} out of 5`;
  return v;
}
