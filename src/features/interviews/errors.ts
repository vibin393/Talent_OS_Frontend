import { errorMessage, isApiError } from "@/lib/api/errors";
import { interviewErrorMessage } from "./format";

/** User-facing message for an interview API error. */
export function interviewError(e: unknown, fallback?: string): string {
  const base = errorMessage(e, fallback);
  return isApiError(e) ? interviewErrorMessage(e.code, base) : base;
}

/** Ids of the interviews named by a 409 `stage_has_scheduled_interviews`. */
export function blockingInterviewIds(e: unknown): string[] {
  if (!isApiError(e) || e.code !== "stage_has_scheduled_interviews") return [];
  const ids = e.details.interview_ids;
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
}
