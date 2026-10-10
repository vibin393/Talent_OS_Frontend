import { describe, expect, it } from "vitest";
import {
  addNode,
  emptyGraph,
  handlesOf,
  historyOf,
  nodeById,
  nodeIdFromPath,
  outline,
  pathHighlight,
  push,
  redo,
  removeNode,
  stepCount,
  undo,
  validateGraph,
} from "./graph-model";
import type { ApprovalNode, Graph } from "./types";

const action = (id: string, next: string | null): Graph["nodes"][number] => ({
  id,
  type: "action",
  action: { type: "notify", params: { recipients: ["entity_owner"], message: id } },
  next,
});

function approvalGraph(): Graph {
  return {
    start: "c1",
    nodes: [
      { id: "c1", type: "condition", when: { field: "priority", op: "eq", value: "high" }, then: "d1", else: "e" },
      { id: "d1", type: "delay", duration: { value: 1, unit: "business_days" }, next: "p1" },
      {
        id: "p1",
        type: "approval",
        title: "Approve the follow-up",
        approver: { kind: "role", ref: "r-1" },
        timeout: { value: 5, unit: "business_days" },
        on_approved: "a1",
        on_rejected: "a2",
        on_timeout: "e",
      },
      action("a1", "e"),
      action("a2", "e"),
      { id: "e", type: "end" },
    ],
  };
}

describe("graph validation", () => {
  it("accepts the acceptance-criteria graph", () => {
    expect(validateGraph(approvalGraph())).toEqual([]);
  });

  it("finds cycles and unreachable steps", () => {
    const g: Graph = { start: "a1", nodes: [action("a1", "d1"), { id: "d1", type: "delay", duration: { value: 1, unit: "hours" }, next: "a1" }, action("x", null)] };
    const reasons = validateGraph(g).map((i) => i.reason);
    expect(reasons).toContain("cycle");
    expect(reasons).toContain("unreachable");
  });

  it("limits steps (end excluded), actions per path and delays", () => {
    const nodes: Graph["nodes"] = Array.from({ length: 26 }, (_, i) => ({ id: `d${i}`, type: "delay" as const, duration: { value: 1, unit: "hours" as const }, next: i < 25 ? `d${i + 1}` : "e" }));
    const long: Graph = { start: "d0", nodes: [...nodes, { id: "e", type: "end" }] };
    expect(stepCount(long)).toBe(26);
    expect(validateGraph(long).map((i) => i.reason)).toContain("too_many_steps");
    expect(validateGraph({ ...long, nodes: long.nodes.slice(1) }, { maxSteps: 25 }).map((i) => i.reason)).not.toContain("too_many_steps");

    const eleven: Graph = { start: "a0", nodes: Array.from({ length: 11 }, (_, i) => action(`a${i}`, i < 10 ? `a${i + 1}` : null)) };
    expect(validateGraph(eleven).map((i) => i.reason)).toContain("too_many_actions");

    const tooLong: Graph = { start: "d", nodes: [{ id: "d", type: "delay", duration: { value: 91, unit: "days" }, next: null }] };
    expect(validateGraph(tooLong)[0].reason).toBe("delay_too_long");
    const tooShort: Graph = { start: "d", nodes: [{ id: "d", type: "delay", duration: { value: 2, unit: "minutes" }, next: null }] };
    expect(validateGraph(tooShort)[0].reason).toBe("delay_too_short");
  });

  it("needs an approved branch and an approver", () => {
    const g = approvalGraph();
    const p = nodeById(g, "p1") as ApprovalNode;
    const broken: Graph = { ...g, nodes: g.nodes.map((n) => (n.id === "p1" ? { ...p, on_approved: null, approver: { kind: "user", ref: null } } : n)) };
    const reasons = validateGraph(broken).map((i) => i.reason);
    expect(reasons).toEqual(expect.arrayContaining(["missing_branch", "approver_unresolved"]));
  });

  it("maps a server error path to the node", () => {
    expect(nodeIdFromPath(approvalGraph(), "nodes[2].on_approved")).toBe("p1");
    expect(nodeIdFromPath(approvalGraph(), "trigger")).toBeNull();
  });
});

describe("editing", () => {
  it("adds approval steps with three branches and keeps the old target", () => {
    let g = emptyGraph();
    const first = addNode(g, null, null, "action");
    g = first.graph;
    expect(g.start).toBe(first.id);
    expect(nodeById(g, first.id)).toMatchObject({ next: "end" });

    const approval = addNode(g, first.id, "next", "approval");
    g = approval.graph;
    const node = nodeById(g, approval.id) as ApprovalNode;
    expect(node.on_approved).toBe("end");
    expect(handlesOf(node).map((h) => h.label)).toEqual(["Approved", "Rejected"]);
    expect(handlesOf({ ...node, timeout: { value: 2, unit: "business_days" } }).map((h) => h.label)).toEqual(["Approved", "Rejected", "Timed out"]);

    const rejected = addNode(g, approval.id, "on_rejected", "action");
    g = rejected.graph;
    expect((nodeById(g, approval.id) as ApprovalNode).on_rejected).toBe(rejected.id);

    const removed = removeNode(g, approval.id);
    expect(nodeById(removed, first.id)).toMatchObject({ next: "end" });
    expect(nodeById(removed, approval.id)).toBeUndefined();
  });

  it("undoes and redoes", () => {
    const a = emptyGraph();
    const b = addNode(a, null, null, "delay").graph;
    let h = push(historyOf(a), b);
    h = undo(h);
    expect(h.present).toBe(a);
    h = redo(h);
    expect(h.present).toBe(b);
  });
});

describe("outline", () => {
  it("renders the form-based equivalent", () => {
    const rows = outline(approvalGraph(), { fields: { priority: "Priority" }, actions: { notify: "Send a notification" } });
    expect(rows.map((r) => [r.depth, r.text])).toEqual([
      [0, "If Priority is high"],
      [1, "Yes:"],
      [2, "Wait 1 business day"],
      [2, "Ask a role to approve 'Approve the follow-up' (times out after 5 business days)"],
      [3, "If approved:"],
      [4, "Send a notification: 'a1'"],
      [3, "If rejected:"],
      [4, "Send a notification: 'a2'"],
      [3, "If timed out:"],
      [4, "End"],
      [1, "No:"],
      [2, "End"],
    ]);
  });
});

describe("dry-run highlighting", () => {
  it("highlights the walked nodes and edges", () => {
    const path = [
      { node_id: "c1", type: "condition", outcome: "yes" },
      { node_id: "d1", type: "delay", outcome: "wait", scheduled_at: "2026-10-06T09:00:00+05:30" },
      { node_id: "p1", type: "approval", outcome: "rejected" },
      { node_id: "a2", type: "action", outcome: "would_run" },
      { node_id: "e", type: "end", outcome: "end" },
    ];
    const { nodes, edges } = pathHighlight(approvalGraph(), path);
    expect([...nodes]).toEqual(["c1", "d1", "p1", "a2", "e"]);
    expect([...edges]).toEqual(["c1:then", "d1:next", "p1:on_rejected", "a2:next"]);
  });
});
