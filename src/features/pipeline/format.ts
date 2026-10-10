/** Display labels and small formatters for the pipeline UI. */
import type { ApplicationOut } from "@/lib/api/types";

export type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";

export const SCREENING_STATUS: Record<string, { label: string; color: BadgeColor }> = {
  draft: { label: "Screening draft", color: "informative" },
  sent: { label: "AI screening sent", color: "brand" },
  consent_declined: { label: "Consent declined", color: "danger" },
  answered: { label: "Answers in — review", color: "warning" },
  reviewed: { label: "Screening reviewed", color: "informative" },
  completed: { label: "Screened", color: "success" },
  expired: { label: "Screening expired", color: "subtle" },
};

export const FEEDBACK_STATUS: Record<string, { label: string; color: BadgeColor }> = {
  interested: { label: "Interested", color: "success" },
  rejected_pending: { label: "Client rejected — confirm", color: "danger" },
  rejected: { label: "Client rejected", color: "danger" },
  on_hold: { label: "Client on hold", color: "warning" },
};

export const SUBMISSION_STATUS: Record<string, { label: string; color: BadgeColor }> = {
  draft: { label: "Draft", color: "subtle" },
  pending_approval: { label: "Pending approval", color: "warning" },
  approved: { label: "Approved — ready to send", color: "brand" },
  sent: { label: "Sent", color: "success" },
  cancelled: { label: "Cancelled", color: "subtle" },
  approval_rejected: { label: "Approval rejected", color: "danger" },
};

export const OUTCOME_LABELS: Record<string, string> = { proceed: "Proceed", hold: "Hold", reject: "Reject" };

export const SOURCE_LABELS: Record<string, string> = {
  manual: "Added manually",
  search: "Search",
  match: "Match",
  ai_match: "AI match",
  saved_list: "Saved list",
  candidate_360: "Candidate 360",
  career_portal: "Career portal",
  import: "Import",
  api: "API",
};

export function daysLabel(days: number): string {
  if (days <= 0) return "Today";
  return days === 1 ? "1 day" : `${days} days`;
}

/** The client-feedback status to show on a card (latest submission first, then the application). */
export function feedbackStatusOf(app: Pick<ApplicationOut, "latest_submission" | "last_client_feedback" | "pending_client_rejection_id">): string | null {
  if (app.pending_client_rejection_id) return "rejected_pending";
  const s = app.latest_submission?.feedback_status;
  if (s && s !== "none") return s;
  return app.last_client_feedback ?? null;
}

/** "87%" from a 0–1 or 0–100 match score. */
export function formatMatch(score: string | number | null | undefined): string | null {
  if (score === null || score === undefined || score === "") return null;
  const n = Number(score);
  if (!Number.isFinite(n)) return null;
  return `${Math.round(n <= 1 ? n * 100 : n)}%`;
}

export function actorLabel(kind: string): string {
  switch (kind) {
    case "user":
      return "Recruiter";
    case "system":
      return "System";
    case "candidate":
      return "Candidate";
    case "workflow":
      return "Workflow";
    case "api_key":
      return "Integration";
    default:
      return kind;
  }
}
