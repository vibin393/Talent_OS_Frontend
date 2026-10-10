/** Pure view model for the offer approval chain (Epic 4 approval requests). */
import type { ApprovalDecision, ApprovalRequest } from "./types";

export type StepState = "approved" | "pending" | "skipped" | "returned" | "rejected" | "waiting" | "cancelled";

export type ChainStep = {
  position: number;
  name: string;
  state: StepState;
  approverUserId: string | null;
  approverRoleId: string | null;
  actorId: string | null;
  comment: string | null;
  at: string | null;
};

function snapshotSteps(r: ApprovalRequest): { position: number; name: string; approverUserId: string | null; approverRoleId: string | null }[] {
  return (r.chain_snapshot ?? [])
    .map((s) => ({
      position: Number(s.position),
      name: typeof s.name === "string" ? s.name : `Step ${String(s.position)}`,
      approverUserId: typeof s.approver_user_id === "string" ? s.approver_user_id : null,
      approverRoleId: typeof s.approver_role_id === "string" ? s.approver_role_id : null,
    }))
    .filter((s) => Number.isFinite(s.position))
    .sort((a, b) => a.position - b.position);
}

const OUTCOME_STATE: Record<ApprovalDecision["outcome"], StepState> = {
  approved: "approved",
  skipped: "skipped",
  changes_requested: "returned",
  rejected: "rejected",
};

/** Every chain step with its state: decided (approved / skipped / returned / rejected), pending (current), or waiting. */
export function chainSteps(r: ApprovalRequest): ChainStep[] {
  const decisions = [...(r.decisions ?? [])].sort((a, b) => a.decided_at.localeCompare(b.decided_at));
  const steps = snapshotSteps(r);
  const known = new Set(steps.map((s) => s.position));
  // Decisions for positions the snapshot does not list still show (defensive).
  for (const d of decisions) if (!known.has(d.position)) steps.push({ position: d.position, name: d.step_name, approverUserId: null, approverRoleId: null });
  steps.sort((a, b) => a.position - b.position);
  return steps.map((s) => {
    const d = [...decisions].reverse().find((x) => x.position === s.position);
    let state: StepState;
    if (d) state = OUTCOME_STATE[d.outcome];
    else if (r.status === "pending" && r.current_position === s.position) state = "pending";
    else if (r.status === "cancelled") state = "cancelled";
    else state = "waiting";
    return {
      position: s.position,
      name: d?.step_name ?? s.name,
      state,
      approverUserId: s.approverUserId,
      approverRoleId: s.approverRoleId,
      actorId: d?.actor_id ?? null,
      comment: d?.comment ?? null,
      at: d?.decided_at ?? null,
    };
  });
}

/**
 * Whether the signed-in user decides the current step: the named approver, or (role-based steps) anyone holding
 * `offer:approve` — the server re-checks the role and rejects others.
 */
export function isCurrentApprover(r: ApprovalRequest | null | undefined, userId: string | null | undefined, canApprove: boolean): boolean {
  if (!r || r.status !== "pending" || !userId || !canApprove) return false;
  if (r.current_approver_user_id) return r.current_approver_user_id === userId;
  return !!r.current_approver_role_id;
}

/** The newest request (the one that matters for actions). */
export function latestRequest(requests: readonly ApprovalRequest[]): ApprovalRequest | null {
  return [...requests].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0] ?? null;
}

/** The comment that sent the offer back (request changes / reject), if the latest request was returned. */
export function returnComment(requests: readonly ApprovalRequest[], statusComment: string | null | undefined): string | null {
  const r = latestRequest(requests);
  if (r && (r.status === "changes_requested" || r.status === "rejected")) {
    const d = [...(r.decisions ?? [])].reverse().find((x) => x.outcome === "changes_requested" || x.outcome === "rejected");
    return d?.comment ?? statusComment ?? null;
  }
  return null;
}

export type DecideAction = "approve" | "reject" | "request_changes";

export function commentRequired(action: DecideAction): boolean {
  return action !== "approve";
}
