/** User-facing messages for the demands API error codes (Epic 4). */
import { adminErrorMessage } from "@/features/admin/errors";
import { rateExceptionInfo, rateExceptionMessage } from "@/features/commercials/format";
import { isApiError } from "@/lib/api/errors";

const MESSAGES: Record<string, string> = {
  client_archived: "This client is archived and cannot receive new demands.",
  invalid_reference: "A selected client, contact or person no longer exists. Refresh and try again.",
  invalid_transition: "This status change is not allowed from the current status.",
  reason_required: "Choose a reason for this status change.",
  human_only_action: "Only a person can perform this action.",
  reopen_guard: "Raise the number of positions before reopening a filled demand.",
  unconfirmed_ai_fields: "Confirm or edit the AI-extracted fields before submitting.",
  demand_archived: "This demand is archived.",
  demand_not_editable: "A cancelled, closed or archived demand cannot be edited.",
  demand_active: "Only draft, cancelled or closed demands can be archived.",
  client_locked: "The client can only change while the demand is a draft.",
  demand_not_open: "Only an Open demand can be published.",
  invalid_jd_kind: "Only a full JD or posting text can be published.",
  bias_flags_unacknowledged: "The JD contains flagged wording. Review it or acknowledge the flags.",
  ai_unavailable: "The AI assistant is unavailable right now. Try again later, or continue manually.",
  demand_not_assignable: "Only Open or On hold demands can be assigned.",
  file_too_large: "The file is larger than 10 MB.",
  unsupported_file_type: "Only PDF and DOCX files are supported.",
  document_too_long: "The document is too long (at most 10 pages or 60,000 characters).",
  text_or_file_required: "Paste the text or upload one file.",
  scan_unavailable: "The document could not be scanned for malware. Try again later.",
  not_current_approver: "You are not the approver of the current step.",
  request_not_pending: "This approval request has already been decided.",
  comment_required: "Add a comment to explain your decision.",
  active_chain_exists: "Another active chain exists for this subject. Deactivate it first.",
  invalid_condition: "One of the step conditions is not valid.",
  invalid_approver: "Each step needs exactly one approver: a user or a role.",
};

export function demandErrorMessage(e: unknown): string {
  // Epic 16: the bill rate is outside the client's rate card (approval started / pending / rejected).
  const rate = rateExceptionInfo(e);
  if (rate) return rateExceptionMessage(rate);
  if (isApiError(e)) {
    if (e.code === "incomplete_demand") {
      const fields = Array.isArray(e.details.fields)
        ? (e.details.fields as { field?: unknown }[]).map((f) => String(f.field ?? "")).filter(Boolean)
        : [];
      return fields.length
        ? `Complete the required fields before submitting: ${fields.map((f) => f.replace(/_/g, " ")).join(", ")}.`
        : "Complete the required fields before submitting.";
    }
    const known = MESSAGES[e.code];
    if (known) return known;
    if (e.status === 404) return "This demand no longer exists, or you cannot see it.";
  }
  return adminErrorMessage(e);
}
