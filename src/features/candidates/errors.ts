/** User-facing messages for the candidate, file and import API error codes (Epic 3). */
import { errorMessage, isApiError } from "@/lib/api/errors";

const MESSAGES: Record<string, string> = {
  forbidden: "You do not have permission to do this.",
  file_too_large: "The file is larger than 10 MB.",
  unsupported_file_type: "This file type is not supported. Upload a PDF or DOCX (attachments may also be PNG or JPEG).",
  file_infected: "The file failed the virus scan and was not stored.",
  scan_unavailable: "The virus scanner is unavailable, so the file could not be accepted. Try again later.",
  import_too_large: "The import is too large: at most 200 files of 10 MB each, or a ZIP up to 200 MB uncompressed.",
  merge_undo_expired: "This merge can no longer be undone (the 30-day window has passed).",
  merge_already_undone: "This merge has already been undone.",
  resume_not_parsed: "This resume has no parsed data to apply.",
  invalid_phone: "One of the phone numbers is not valid.",
  candidate_archived: "This candidate is archived. Unarchive it first.",
  candidate_merged: "This candidate was merged into another profile.",
  duplicate_resolved: "This duplicate has already been resolved.",
  skill_exists: "A skill with this name already exists.",
  alias_exists: "This alias is already used by another skill.",
  list_exists: "A list with this name already exists.",
  budget_platform_managed: "The AI budget is managed by the platform operator.",
};

/** Message for a candidate-area failure (known codes first, then the generic mapping). */
export function candidateErrorMessage(e: unknown): string {
  if (isApiError(e)) {
    if (e.code === "forbidden" && typeof e.details.permission === "string") {
      return `You need the "${e.details.permission}" permission to do this.`;
    }
    const known = MESSAGES[e.code];
    if (known) return known;
    if (e.status === 404) return "This item no longer exists or you do not have access to it.";
    if (e.status === 409 && e.message) return e.message;
    if (e.status === 422 && Array.isArray(e.details.fields) && e.details.fields.length > 0) {
      const first = e.details.fields[0] as { field?: string; message?: string };
      if (first?.message) return `${first.field ? `${first.field.replace(/^body\./, "")}: ` : ""}${first.message}`;
    }
  }
  return errorMessage(e);
}
