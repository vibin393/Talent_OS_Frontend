import { describe, expect, it } from "vitest";
import { chainSteps, commentRequired, isCurrentApprover, latestRequest, returnComment } from "./approval";
import type { ApprovalRequest } from "./types";

function request(over: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    id: "r1",
    subject_type: "offer",
    subject_id: "o1",
    chain_id: "c1",
    chain_snapshot: [
      { position: 2, name: "Finance", approver_user_id: "u-fin", approver_role_id: null },
      { position: 1, name: "Low margin check", approver_user_id: null, approver_role_id: "role-1" },
    ],
    facts: {},
    status: "pending",
    current_position: 2,
    current_approver_user_id: "u-fin",
    current_approver_role_id: null,
    steps_source: "chain",
    submitted_by: "u-rec",
    submitted_at: "2026-10-01T10:00:00Z",
    completed_at: null,
    decisions: [
      { id: "d1", position: 1, step_name: "Low margin check", outcome: "skipped", actor_kind: "system", actor_id: null, comment: null, evaluated_condition: null, decided_at: "2026-10-01T10:00:01Z" },
    ],
    ...over,
  };
}

describe("offer approval panel", () => {
  it("lists steps in order with their states", () => {
    const steps = chainSteps(request());
    expect(steps.map((s) => [s.name, s.state])).toEqual([
      ["Low margin check", "skipped"],
      ["Finance", "pending"],
    ]);
  });

  it("shows decision buttons only to the current step's approver", () => {
    expect(isCurrentApprover(request(), "u-fin", true)).toBe(true);
    expect(isCurrentApprover(request(), "u-other", true)).toBe(false);
    expect(isCurrentApprover(request(), "u-fin", false)).toBe(false);
    expect(isCurrentApprover(request({ status: "approved" }), "u-fin", true)).toBe(false);
    // Role-based step: anyone with offer:approve sees the buttons; the server checks the role.
    expect(isCurrentApprover(request({ current_approver_user_id: null, current_approver_role_id: "role-1" }), "u-x", true)).toBe(true);
  });

  it("requires a comment to reject or request changes", () => {
    expect(commentRequired("approve")).toBe(false);
    expect(commentRequired("reject")).toBe(true);
    expect(commentRequired("request_changes")).toBe(true);
  });

  it("surfaces the return comment of the latest request", () => {
    const returned = request({
      id: "r2",
      status: "changes_requested",
      submitted_at: "2026-10-02T10:00:00Z",
      decisions: [
        { id: "d2", position: 2, step_name: "Finance", outcome: "changes_requested", actor_kind: "user", actor_id: "u-fin", comment: "Lower the bonus", evaluated_condition: null, decided_at: "2026-10-02T11:00:00Z" },
      ],
    });
    expect(latestRequest([request(), returned])?.id).toBe("r2");
    expect(returnComment([request(), returned], null)).toBe("Lower the bonus");
    expect(chainSteps(returned).find((s) => s.name === "Finance")?.state).toBe("returned");
    expect(returnComment([request()], "x")).toBeNull();
  });
});
