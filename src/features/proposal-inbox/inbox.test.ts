import { describe, expect, it, vi } from "vitest";
import type { ProposalOut } from "@/lib/api/agentic-types";
import { ApiError } from "@/lib/api/errors";
import {
  bulkDialogItems,
  bulkEligible,
  bulkTitle,
  createOpenedTracker,
  decisionError,
  inBucket,
  inboxQuery,
  itemsForTab,
  nextAfterDecision,
  nextIndex,
  NOT_PENDING_MESSAGE,
  parseEdited,
  rejectReasonError,
  schemaFields,
  STALE_MESSAGE,
  visibleTabs,
  withoutCopilotDrafts,
} from "./logic";

const prp = (over: Partial<ProposalOut> = {}): ProposalOut => ({
  id: "p1",
  human_id: "PRP-000001",
  origin: "agent",
  agent_key: "sourcing",
  agent_name: "Sourcing Agent",
  tool_key: "pipeline.add_candidate",
  tool_title: "Add to pipeline",
  title: "Add Asha to the pipeline",
  preview: {
    title: "Add Asha",
    summary: "Strong match",
    fields: [
      ["demand_id", "d1"],
      ["Candidate", "Asha"],
    ],
    renderer: null,
  },
  risk: "low",
  rationale: null,
  confidence: "0.8",
  evidence: [],
  target_type: "candidate",
  target_id: "c1",
  status: "pending",
  edited: false,
  assignee_user_id: "me",
  route_role_key: null,
  owner_user_id: "me",
  expires_at: "2026-10-10T00:00:00Z",
  decided_by: null,
  decided_at: null,
  decision_note: null,
  executed_at: null,
  error_code: null,
  run_id: "r1",
  can_decide: true,
  args: null,
  input_schema: null,
  ...over,
});

describe("bulk eligibility", () => {
  it("allows only the same agent, action and Demand", () => {
    const first = prp();
    expect(bulkEligible(prp({ id: "p2" }), [first])).toBe(true);
    expect(bulkEligible(prp({ id: "p3", agent_key: "screening" }), [first])).toBe(false);
    expect(bulkEligible(prp({ id: "p4", tool_key: "messaging.send" }), [first])).toBe(false);
    expect(bulkEligible(prp({ id: "p5", preview: { ...first.preview, fields: [["demand_id", "d2"]] } }), [first])).toBe(false);
    expect(bulkEligible(prp({ id: "p6", can_decide: false }), [])).toBe(false);
  });
});

describe("bulk dialog", () => {
  it("lists every selected item with its preview expanded", () => {
    const items = bulkDialogItems([prp(), prp({ id: "p2", human_id: "PRP-000002" })]);
    expect(items.map((i) => i.human_id)).toEqual(["PRP-000001", "PRP-000002"]);
    expect(items[0].rendered.rows).toContainEqual({ label: "Candidate", value: "Asha" });
    expect(bulkTitle("approve", 2)).toBe("Approve 2 proposals?");
  });
});

describe("decision errors", () => {
  it("maps 409 proposal_stale to the warning with Re-run agent", () => {
    expect(decisionError(new ApiError(409, "proposal_stale", "stale"))).toEqual({ intent: "warning", text: STALE_MESSAGE, rerun: true });
    expect(STALE_MESSAGE).toBe("This record changed after the agent proposed this.");
  });

  it("maps not-pending and 403", () => {
    expect(decisionError(new ApiError(409, "proposal_not_pending", "x")).text).toBe(NOT_PENDING_MESSAGE);
    expect(decisionError(new ApiError(403, "forbidden", "x")).text).toBe("You can no longer perform this action.");
  });

  it("requires a 3-character reject reason", () => {
    expect(rejectReasonError("no")).not.toBeNull();
    expect(rejectReasonError("Wrong role")).toBeNull();
  });
});

describe("opened signal", () => {
  it("fires once per proposal", () => {
    const send = vi.fn();
    const track = createOpenedTracker(send);
    expect(track("a")).toBe(true);
    expect(track("a")).toBe(false);
    track("b");
    expect(send.mock.calls).toEqual([["a"], ["b"]]);
  });
});

describe("Copilot drafts", () => {
  it("are never listed", () => {
    const items = [prp(), prp({ id: "c", origin: "copilot" })];
    expect(withoutCopilotDrafts(items).map((p) => p.id)).toEqual(["p1"]);
    expect(itemsForTab(items, "all", "me").map((p) => p.id)).toEqual(["p1"]);
  });

  it("splits mine into assigned and queues", () => {
    const items = [prp(), prp({ id: "q", assignee_user_id: null, route_role_key: "recruiter" })];
    expect(itemsForTab(items, "assigned", "me").map((p) => p.id)).toEqual(["p1"]);
    expect(itemsForTab(items, "queues", "me").map((p) => p.id)).toEqual(["q"]);
    expect(new URLSearchParams(inboxQuery("queues")).get("mine")).toBe("true");
    expect(new URLSearchParams(inboxQuery("all")).has("mine")).toBe(false);
    expect(visibleTabs(false).map((t) => t.label)).toEqual(["Assigned to me", "My queues"]);
  });
});

describe("keyboard navigation", () => {
  it("moves with arrows, Home and End within bounds", () => {
    expect(nextIndex("ArrowDown", 0, 3)).toBe(1);
    expect(nextIndex("ArrowDown", 2, 3)).toBe(2);
    expect(nextIndex("ArrowUp", 0, 3)).toBe(0);
    expect(nextIndex("End", 0, 3)).toBe(2);
    expect(nextIndex("Home", 2, 3)).toBe(0);
    expect(nextIndex("ArrowDown", 0, 0)).toBe(-1);
  });

  it("focuses the next item after a decision", () => {
    expect(nextAfterDecision(["a", "b", "c"], "b")).toBe("c");
    expect(nextAfterDecision(["a", "b", "c"], "c")).toBe("b");
    expect(nextAfterDecision(["a"], "a")).toBeNull();
  });
});

describe("ageing and edit form", () => {
  const now = Date.parse("2026-10-09T12:00:00Z");

  it("buckets by age and expiry", () => {
    expect(inBucket({ created_at: "2026-10-09T10:00:00Z", expires_at: "2026-10-20T00:00:00Z" }, "under_4h", now)).toBe(true);
    expect(inBucket({ created_at: "2026-10-08T00:00:00Z", expires_at: "2026-10-20T00:00:00Z" }, "over_24h", now)).toBe(true);
    expect(inBucket({ created_at: null, expires_at: "2026-10-09T20:00:00Z" }, "expiring", now)).toBe(true);
  });

  it("generates fields from input_schema and parses edits", () => {
    const fields = schemaFields({
      properties: { note: { type: "string", maxLength: 100 }, hours: { type: "integer" }, channel: { enum: ["email", "sms"] } },
      required: ["note"],
    });
    expect(fields.map((f) => [f.name, f.type, f.required])).toEqual([
      ["note", "string", true],
      ["hours", "integer", false],
      ["channel", "enum", false],
    ]);
    expect(parseEdited(fields, { note: "Hi", hours: "2.5", channel: "sms" }, { note: "x" }).errors).toEqual({ hours: "Enter a number." });
    expect(parseEdited(fields, { note: "Hi", hours: "3", channel: "" }, { other: 1 }).args).toEqual({ note: "Hi", hours: 3, other: 1 });
  });
});
