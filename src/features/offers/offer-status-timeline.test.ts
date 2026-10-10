import { describe, expect, it } from "vitest";
import { actorText, buildTimeline } from "./timeline";

describe("offer status timeline", () => {
  it("merges history and responses newest first with readable labels", () => {
    const t = buildTimeline(
      [
        { from_status: null, to_status: "draft", actor_kind: "user", actor_id: "u1", version_no: 1, reason: null, at: "2026-10-01T09:00:00Z" },
        { from_status: "draft", to_status: "pending_approval", actor_kind: "user", actor_id: "u1", version_no: 1, reason: null, at: "2026-10-01T10:00:00Z" },
        { from_status: "pending_approval", to_status: "draft", actor_kind: "user", actor_id: "u2", version_no: 1, reason: "Lower bonus", at: "2026-10-01T11:00:00Z" },
        { from_status: "approved", to_status: "released", actor_kind: "user", actor_id: "u1", version_no: 2, reason: null, at: "2026-10-02T09:00:00Z" },
        { from_status: "viewed", to_status: "accepted", actor_kind: "candidate", actor_id: null, version_no: 2, reason: null, at: "2026-10-03T09:00:00Z" },
      ],
      [
        {
          decision: "accepted",
          version_no: 2,
          typed_name: "Asha Rao",
          decline_reason: null,
          ip: "203.0.113.4",
          user_agent: "UA",
          channel: "secure_link",
          letter_sha256: "abcdef0123456789",
          decided_at: "2026-10-03T09:00:00Z",
        },
      ],
    );
    expect(t.map((e) => e.label)).toEqual([
      "Accepted by typed name 'Asha Rao' from 203.0.113.4 on version 2",
      "Accepted",
      "Released",
      "Returned by the approver",
      "Submitted for approval",
      "Offer created",
    ]);
    expect(t[0].detail).toMatch(/secure link · letter SHA-256 abcdef012345…/);
    expect(t[3].detail).toBe("Lower bonus");
  });

  it("names actors", () => {
    expect(actorText("user", "Priya")).toBe("Priya");
    expect(actorText("system", null)).toBe("the system");
    expect(actorText("candidate", null)).toBe("the candidate");
  });
});
