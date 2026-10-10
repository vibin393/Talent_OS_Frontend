/** Labels and badge colors for interview enums, plus small pure helpers shared by the interview views. */
import type { InterviewMode, InterviewOut, InterviewStatus, ParticipantOut, Recommendation, StageKind } from "./types";

export type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";

export const STATUS_LABELS: Record<InterviewStatus, { label: string; color: BadgeColor }> = {
  scheduled: { label: "Scheduled", color: "brand" },
  completed: { label: "Completed", color: "success" },
  cancelled: { label: "Cancelled", color: "subtle" },
  no_show: { label: "No-show", color: "danger" },
};

export const MODE_LABELS: Record<InterviewMode, string> = {
  video: "Video call",
  phone: "Phone",
  in_person: "In person",
};

export const KIND_LABELS: Record<StageKind, string> = {
  technical: "Technical",
  hr: "HR",
  client: "Client",
  managerial: "Managerial",
  other: "Other",
};
export const STAGE_KINDS = Object.keys(KIND_LABELS) as StageKind[];

export const RECOMMENDATIONS: { value: Recommendation; label: string }[] = [
  { value: "strong_yes", label: "Strong yes" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "strong_no", label: "Strong no" },
];

export function recommendationLabel(r: Recommendation | null | undefined): string {
  return RECOMMENDATIONS.find((x) => x.value === r)?.label ?? "—";
}

export function interviewerNames(i: Pick<InterviewOut, "participants">): string {
  return (
    i.participants
      .filter((p) => p.kind === "interviewer_internal" || p.kind === "interviewer_external")
      .map((p) => p.name || p.email)
      .join(", ") || "—"
  );
}

/** The signed-in user's participant row on an interview, if any. */
export function myParticipant(i: Pick<InterviewOut, "participants">, userId: string | null | undefined): ParticipantOut | null {
  if (!userId) return null;
  return i.participants.find((p) => p.user_id === userId) ?? null;
}

/** Whether the user still owes a scorecard for an interview that has started (and was not cancelled). */
export function needsMyScorecard(i: InterviewOut, userId: string | null | undefined, now: number = Date.now()): boolean {
  const me = myParticipant(i, userId);
  if (!me || !me.scorecard_required || me.scorecard_status === "submitted") return false;
  if (i.status === "cancelled" || i.status === "no_show") return false;
  return new Date(i.starts_at).getTime() <= now;
}

/** "2/3" scorecard counter text. */
export function scorecardCount(i: Pick<InterviewOut, "scorecards_submitted" | "scorecards_required">): string {
  return `${i.scorecards_submitted}/${i.scorecards_required}`;
}

/** "45 min" / "1 h" / "1 h 30 min". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Human message for the Epic 7 error codes (falls back to the server message). */
export function interviewErrorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "application_not_interviewable":
      return "Interviews can only be scheduled for applications in Submitted or Interviewing.";
    case "candidate_email_missing":
      return "The candidate has no email address. Add one, or turn off “Send invitations”.";
    case "invalid_timezone":
      return "Choose a valid time zone.";
    case "nonexistent_local_time":
      return "That local time does not exist in the chosen time zone (daylight saving change). Pick another time.";
    case "version_conflict":
      return "Someone else changed this interview. Close the dialog and try again.";
    case "interview_not_scheduled":
      return "Only scheduled interviews can be changed.";
    case "interview_not_started":
      return "You can submit the scorecard once the interview has started.";
    case "scorecard_locked":
      return "This scorecard was already submitted and can no longer be edited.";
    case "outcome_before_interview":
      return "Record an outcome after at least one interview in this stage has started.";
    case "final_stage_not_advanced":
      return "Advance the candidate on the final interview stage before moving them to Selected.";
    case "human_only_action":
      return "Only a person can record this decision.";
    case "stage_has_scheduled_interviews":
      return "This stage has scheduled interviews. Cancel or reschedule them before removing the stage.";
    default:
      return fallback;
  }
}
