/**
 * Pure pipeline rules for the UI. The server (§5.2 transition table) stays authoritative: these helpers
 * only decide what a drop or a menu item *opens* (move, reason dialog, submit wizard) and which drop
 * targets are dimmed, from `GET /pipeline/stages?include_transitions=true`.
 */
import type { PipelineReasonKind, PipelineStageOut, PipelineStageTransition } from "@/lib/api/types";

export const TERMINAL_KEYS: readonly string[] = ["hired", "rejected", "withdrawn"];

export function isTerminalKey(key: string): boolean {
  return TERMINAL_KEYS.includes(key);
}

/** What happens when an application in `from` is dropped on (or moved to) `to`. */
export type DropAction =
  | { kind: "same" }
  | { kind: "move" }
  | { kind: "reason"; reason: PipelineReasonKind }
  | { kind: "wizard" }
  | { kind: "invalid"; why: string };

type StageLike = Pick<PipelineStageOut, "id" | "key" | "label">;

/** Whether a user (not the system) may move from `fromId` to `toId` per the transition list. */
export function userMayMove(
  transitions: readonly PipelineStageTransition[] | null | undefined,
  fromId: string,
  toId: string,
): boolean {
  return (transitions ?? []).some((t) => t.from_stage_id === fromId && t.to_stage_id === toId && t.actors.includes("user"));
}

/**
 * Classify a drop. Shortlisted → Submitted is system-only on the server; the UI opens the
 * Submit-to-client wizard instead (whose send path performs the transition).
 */
export function dropAction(
  from: StageLike,
  to: StageLike,
  transitions: readonly PipelineStageTransition[] | null | undefined,
): DropAction {
  if (from.id === to.id) return { kind: "same" };
  if (to.key === "submitted") {
    return from.key === "shortlisted"
      ? { kind: "wizard" }
      : { kind: "invalid", why: "Only shortlisted candidates can be submitted to the client." };
  }
  if (!userMayMove(transitions, from.id, to.id)) {
    return { kind: "invalid", why: `Cannot move from ${from.label} to ${to.label}.` };
  }
  if (to.key === "rejected") return { kind: "reason", reason: "reject" };
  if (to.key === "withdrawn") return { kind: "reason", reason: "withdraw" };
  if (isTerminalKey(from.key) && to.key === "applied") return { kind: "reason", reason: "reopen" };
  return { kind: "move" };
}

/** Ids of the stages an application in `from` can be dropped on (for dimming the others). */
export function validDropTargets(
  from: StageLike,
  stages: readonly StageLike[],
  transitions: readonly PipelineStageTransition[] | null | undefined,
): Set<string> {
  const out = new Set<string>();
  for (const s of stages) {
    const a = dropAction(from, s, transitions);
    if (a.kind !== "invalid" && a.kind !== "same") out.add(s.id);
  }
  return out;
}

/** Live (non-archived) stages in board order. */
export function liveStages<T extends Pick<PipelineStageOut, "archived_at" | "position">>(stages: readonly T[]): T[] {
  return stages.filter((s) => !s.archived_at).sort((a, b) => a.position - b.position);
}

/** Client-side check mirroring the server's reason rules (422 `reason_required` / `note_required`). */
export function reasonErrors(
  kind: PipelineReasonKind,
  reasonCode: string | null,
  note: string,
): { reason?: string; note?: string } {
  const out: { reason?: string; note?: string } = {};
  if (kind === "reopen") {
    if (!note.trim()) out.note = "Say why this application is being reopened.";
    return out;
  }
  if (!reasonCode) out.reason = "Choose a reason.";
  if (reasonCode === "other" && !note.trim()) out.note = "A note is required for “Other”.";
  return out;
}

/** Human copy for pipeline API error codes (409 / 422). */
export function pipelineErrorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "use_submission_flow":
      return "Use “Submit to client” to move a candidate to Submitted.";
    case "transition_not_allowed":
      return "That stage change is not allowed.";
    case "stage_conflict":
      return "Someone else moved this candidate. The board has been refreshed.";
    case "application_exists":
      return "This candidate is already in the pipeline.";
    case "demand_not_accepting":
    case "demand_closed":
      return "This demand is not accepting applications (only Open or On hold demands are).";
    case "reason_required":
      return "A reason is required.";
    case "note_required":
      return "A note is required for this reason.";
    case "invalid_reason_code":
      return "That reason is no longer available.";
    case "review_required":
      return "Mark the AI screening as reviewed before setting an outcome.";
    case "candidate_email_missing":
      return "The candidate has no email address, so the screening link cannot be sent.";
    case "ai_unavailable":
      return "AI is unavailable right now. Use the recruiter questionnaire instead.";
    case "not_shortlisted":
      return "Only shortlisted candidates can be submitted.";
    case "submission_limit_reached":
      return "The demand's submission limit has been reached.";
    case "prior_submission_warning":
      return "Submitted to this client recently — a reason is required.";
    case "submission_consent_required":
      return "The candidate has not consented to be submitted to this client.";
    case "currency_mismatch":
      return "Pay and bill rates must use the demand's currency.";
    case "resume_not_parsed":
      return "The resume is not parsed yet — send the original resume instead.";
    case "resume_missing":
      return "The candidate has no resume on file.";
    case "invalid_recipients":
      return "Recipients must be active client contacts with an email address.";
    default:
      return fallback;
  }
}
