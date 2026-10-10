import type { ApprovalNode, Duration, DurationUnit, Graph, GraphNode, NodeType, OutlineRow, PathStep } from "./types";

/**
 * Pure graph model of the workflow builder (Epic 32 B1). Client validation mirrors the backend `graph.py`
 * (acyclic, reachable, <= max steps excluding `end`, <= 10 actions on any path, delay bounds, approval branches);
 * the server stays authoritative (422 `invalid_graph` with `details.path`).
 */

export const MAX_STEPS = 25;
export const MAX_ACTIONS = 10;
export const MAX_DELAY_DAYS = 90;
export const MIN_DELAY_MINUTES = 5;

export const NODE_LABELS: Record<NodeType, string> = {
  condition: "Condition",
  delay: "Delay",
  approval: "Approval",
  action: "Action",
  end: "End",
};

export const UNIT_LABELS: Record<DurationUnit, string> = {
  minutes: "Minutes",
  hours: "Hours",
  days: "Days",
  business_hours: "Business hours",
  business_days: "Business days",
};

export type Handle = { field: string; label: string };

/** Outgoing handles per node type (field of the node that holds the target id). */
export const HANDLES: Record<NodeType, readonly Handle[]> = {
  condition: [
    { field: "then", label: "Yes" },
    { field: "else", label: "No" },
  ],
  delay: [{ field: "next", label: "Next" }],
  approval: [
    { field: "on_approved", label: "Approved" },
    { field: "on_rejected", label: "Rejected" },
    { field: "on_timeout", label: "Timed out" },
  ],
  action: [{ field: "next", label: "Next" }],
  end: [],
};

export function handlesOf(node: GraphNode): readonly Handle[] {
  if (node.type === "approval" && !node.timeout) return HANDLES.approval.filter((h) => h.field !== "on_timeout");
  return HANDLES[node.type];
}

type Edge = { from: string; field: string; to: string };

function target(node: GraphNode, field: string): string | null {
  const v = (node as Record<string, unknown>)[field];
  return typeof v === "string" && v ? v : null;
}

export function edgesOf(node: GraphNode): Edge[] {
  return HANDLES[node.type].flatMap((h) => {
    const to = target(node, h.field);
    return to ? [{ from: node.id, field: h.field, to }] : [];
  });
}

export function allEdges(graph: Graph): Edge[] {
  return graph.nodes.flatMap(edgesOf);
}

export function nodeById(graph: Graph, id: string): GraphNode | undefined {
  return graph.nodes.find((n) => n.id === id);
}

export function stepCount(graph: Graph): number {
  return graph.nodes.filter((n) => n.type !== "end").length;
}

export function newNodeId(graph: Graph, type: NodeType): string {
  const prefix = { condition: "c", delay: "d", approval: "p", action: "a", end: "e" }[type];
  const used = new Set(graph.nodes.map((n) => n.id));
  for (let i = 1; ; i++) if (!used.has(`${prefix}${i}`)) return `${prefix}${i}`;
}

export function defaultNode(type: NodeType, id: string): GraphNode {
  switch (type) {
    case "condition":
      return { id, type, when: {}, then: null, else: null };
    case "delay":
      return { id, type, duration: { value: 1, unit: "business_days" }, next: null };
    case "approval":
      return { id, type, title: "Approval", approver: { kind: "entity_owner", ref: null }, escalation_policy_id: null, timeout: null, on_approved: null, on_rejected: null, on_timeout: null };
    case "action":
      return { id, type, action: { type: "", params: {} }, next: null };
    case "end":
      return { id, type };
  }
}

/** The primary outgoing field a node continues on when it is inserted before an existing target. */
function primaryField(type: NodeType): string | null {
  return type === "condition" ? "then" : type === "approval" ? "on_approved" : type === "end" ? null : "next";
}

function setField(node: GraphNode, field: string, value: string | null): GraphNode {
  return { ...node, [field]: value } as GraphNode;
}

/**
 * Insert a new node of `type` on the edge `fromId.field` (or as the new start when `fromId` is null); the new
 * node continues to the edge's previous target.
 */
export function addNode(graph: Graph, fromId: string | null, field: string | null, type: NodeType): { graph: Graph; id: string } {
  const id = newNodeId(graph, type);
  let node = defaultNode(type, id);
  const previous = fromId && field ? target(nodeById(graph, fromId) as GraphNode, field) : graph.start || null;
  const primary = primaryField(type);
  if (previous && primary) node = setField(node, primary, previous);
  const nodes = graph.nodes.map((n) => (n.id === fromId && field ? setField(n, field, id) : n));
  const from = fromId ? graph.layout?.[fromId] : undefined;
  const layout = { ...(graph.layout ?? {}), [id]: { x: (from?.x ?? 0) + (field === "else" || field === "on_rejected" ? 260 : 0), y: (from?.y ?? -140) + 140 } };
  return { graph: { start: fromId ? graph.start : id, nodes: [...nodes, node], layout }, id };
}

/** Remove a node; incoming edges are reconnected to the node's primary continuation. */
export function removeNode(graph: Graph, id: string): Graph {
  const node = nodeById(graph, id);
  if (!node) return graph;
  const primary = primaryField(node.type);
  const continuation = primary ? target(node, primary) : null;
  const nodes = graph.nodes
    .filter((n) => n.id !== id)
    .map((n) => {
      let out = n;
      for (const h of HANDLES[n.type]) if (target(n, h.field) === id) out = setField(out, h.field, continuation);
      return out;
    });
  const layout = { ...(graph.layout ?? {}) };
  delete layout[id];
  const start = graph.start === id ? (continuation ?? nodes[0]?.id ?? "") : graph.start;
  return { start, nodes, layout };
}

export function updateNode(graph: Graph, node: GraphNode): Graph {
  return { ...graph, nodes: graph.nodes.map((n) => (n.id === node.id ? node : n)) };
}

// ================================================================ validation
export type Issue = { nodeId: string | null; reason: string; message: string };

function durationDays(d: Duration): number {
  return { minutes: d.value / 1440, hours: d.value / 24, days: d.value, business_hours: d.value / 24, business_days: d.value }[d.unit];
}

function durationIssue(d: Duration | null | undefined, nodeId: string, maxDays: number): Issue | null {
  if (!d) return null;
  if (!Number.isInteger(d.value) || d.value < 1) return { nodeId, reason: "invalid_duration", message: "Enter a whole number of at least 1." };
  if (d.unit === "minutes" && d.value < MIN_DELAY_MINUTES) return { nodeId, reason: "delay_too_short", message: `Delays are at least ${MIN_DELAY_MINUTES} minutes.` };
  if (durationDays(d) > maxDays) return { nodeId, reason: "delay_too_long", message: `Delays are at most ${maxDays} days.` };
  return null;
}

export function validateGraph(graph: Graph, limits: { maxSteps?: number; maxActions?: number; maxDelayDays?: number } = {}): Issue[] {
  const maxSteps = limits.maxSteps ?? MAX_STEPS;
  const maxActions = limits.maxActions ?? MAX_ACTIONS;
  const maxDelay = limits.maxDelayDays ?? MAX_DELAY_DAYS;
  const issues: Issue[] = [];
  const ids = new Map(graph.nodes.map((n) => [n.id, n]));
  if (!ids.has(graph.start)) issues.push({ nodeId: null, reason: "unknown_node", message: "The workflow has no start step." });
  if (stepCount(graph) > maxSteps) issues.push({ nodeId: null, reason: "too_many_steps", message: `A workflow has at most ${maxSteps} steps.` });
  for (const e of allEdges(graph)) if (!ids.has(e.to)) issues.push({ nodeId: e.from, reason: "unknown_node", message: "A branch points to a missing step." });

  // cycles + reachability
  const state = new Map<string, 1 | 2>();
  let cycleAt: string | null = null;
  const visit = (id: string) => {
    state.set(id, 1);
    const node = ids.get(id);
    for (const e of node ? edgesOf(node) : []) {
      if (!ids.has(e.to)) continue;
      if (state.get(e.to) === 1) cycleAt = cycleAt ?? id;
      else if (!state.has(e.to)) visit(e.to);
    }
    state.set(id, 2);
  };
  if (ids.has(graph.start)) visit(graph.start);
  if (cycleAt) issues.push({ nodeId: cycleAt, reason: "cycle", message: "The workflow loops back on itself." });
  for (const n of graph.nodes) if (!state.has(n.id)) issues.push({ nodeId: n.id, reason: "unreachable", message: "This step is not connected to the start." });

  if (!cycleAt) {
    const memo = new Map<string, number>();
    const actions = (id: string): number => {
      if (memo.has(id)) return memo.get(id) as number;
      const node = ids.get(id);
      if (!node) return 0;
      const below = Math.max(0, ...edgesOf(node).map((e) => actions(e.to)));
      const v = below + (node.type === "action" ? 1 : 0);
      memo.set(id, v);
      return v;
    };
    if (ids.has(graph.start) && actions(graph.start) > maxActions) issues.push({ nodeId: null, reason: "too_many_actions", message: `At most ${maxActions} actions on any path.` });
  }

  for (const n of graph.nodes) {
    if (n.type === "delay") {
      const i = durationIssue(n.duration, n.id, maxDelay);
      if (i) issues.push(i);
    } else if (n.type === "approval") {
      if (!n.title.trim()) issues.push({ nodeId: n.id, reason: "missing_title", message: "Give the approval a title." });
      if ((n.approver.kind === "user" || n.approver.kind === "role") && !n.approver.ref) issues.push({ nodeId: n.id, reason: "approver_unresolved", message: "Choose the approver." });
      if (!n.on_approved) issues.push({ nodeId: n.id, reason: "missing_branch", message: "Add a step for “Approved”." });
      const i = durationIssue(n.timeout, n.id, maxDelay);
      if (i) issues.push(i);
    } else if (n.type === "action" && !n.action.type) {
      issues.push({ nodeId: n.id, reason: "missing_action", message: "Choose what the action does." });
    }
  }
  return issues;
}

/** `nodes[3].next` / `nodes[1].action.params.title` -> the node id at that index. */
export function nodeIdFromPath(graph: Graph, path: string | null | undefined): string | null {
  const m = /^nodes\[(\d+)\]/.exec(path ?? "");
  if (!m) return null;
  return graph.nodes[Number(m[1])]?.id ?? null;
}

// ================================================================ outline
const OP_TEXT: Record<string, string> = {
  eq: "is", ne: "is not", in: "is one of", not_in: "is not one of", gt: ">", gte: ">=", lt: "<", lte: "<=", contains: "contains",
  not_contains: "does not contain", is_empty: "is empty", is_not_empty: "is not empty", starts_with: "starts with",
};

export function conditionText(cond: unknown, labels: Record<string, string> = {}): string {
  if (!cond || typeof cond !== "object" || Object.keys(cond).length === 0) return "always";
  const c = cond as Record<string, unknown>;
  for (const k of ["all", "any"] as const) {
    if (Array.isArray(c[k])) {
      const parts = (c[k] as unknown[]).map((x) => conditionText(x, labels));
      const joined = parts.join(k === "all" ? " and " : " or ");
      return parts.length > 1 ? `(${joined})` : joined;
    }
  }
  if (c.not) return `not ${conditionText(c.not, labels)}`;
  const field = labels[String(c.field)] ?? String(c.field);
  const op = OP_TEXT[String(c.op)] ?? String(c.op);
  if (c.op === "is_empty" || c.op === "is_not_empty") return `${field} ${op}`;
  const v = Array.isArray(c.value) ? c.value.join(", ") : String(c.value);
  return `${field} ${op} ${v}`;
}

export function durationText(d: Duration): string {
  const label = UNIT_LABELS[d.unit].toLowerCase();
  return `${d.value} ${d.value === 1 ? label.replace(/s$/, "") : label}`;
}

const APPROVER_TEXT: Record<string, string> = {
  user: "a named user",
  role: "a role",
  entity_owner: "the record owner",
  primary_recruiter: "the primary recruiter",
};

export function nodeText(node: GraphNode, labels: { fields?: Record<string, string>; actions?: Record<string, string> } = {}): string {
  switch (node.type) {
    case "condition":
      return `If ${conditionText(node.when, labels.fields)}`;
    case "delay":
      return `Wait ${durationText(node.duration)}`;
    case "approval":
      return `Ask ${APPROVER_TEXT[node.approver.kind] ?? node.approver.kind} to approve '${node.title}'${node.timeout ? ` (times out after ${durationText(node.timeout)})` : ""}`;
    case "action": {
      const label = labels.actions?.[node.action.type] ?? (node.action.type || "Choose an action");
      const p = node.action.params;
      if (node.action.type === "create_task" && p.title) return `${label}: '${String(p.title)}'`;
      if (node.action.type === "notify" && p.message) return `${label}: '${String(p.message)}'`;
      return label;
    }
    case "end":
      return "End";
  }
}

const BRANCH_TEXT: Record<string, string> = { then: "Yes", else: "No", on_approved: "If approved", on_rejected: "If rejected", on_timeout: "If timed out" };

/** Client mirror of the server outline (used while the graph has unsaved changes). */
export function outline(graph: Graph, labels: { fields?: Record<string, string>; actions?: Record<string, string> } = {}): OutlineRow[] {
  const rows: OutlineRow[] = [];
  const printed = new Set<string>();
  const walk = (start: string | null | undefined, depth: number) => {
    let id = start ?? null;
    for (let guard = 0; id && guard < 200; guard++) {
      const node = nodeById(graph, id);
      if (!node) return;
      if (node.type === "end") {
        if (depth === 0) rows.push({ depth, node_id: id, kind: "end", text: "End" });
        return;
      }
      if (printed.has(id)) {
        rows.push({ depth, node_id: id, kind: "goto", text: `Continue at: ${nodeText(node, labels)}` });
        return;
      }
      printed.add(id);
      rows.push({ depth, node_id: id, kind: node.type, text: nodeText(node, labels) });
      if (node.type === "condition" || node.type === "approval") {
        for (const h of handlesOf(node)) {
          rows.push({ depth: depth + 1, node_id: id, kind: "branch", text: `${BRANCH_TEXT[h.field]}:` });
          const to = target(node, h.field);
          if (to && nodeById(graph, to)?.type !== "end") walk(to, depth + 2);
          else rows.push({ depth: depth + 2, node_id: to ?? id, kind: "end", text: "End" });
        }
        return;
      }
      id = target(node, "next");
    }
  };
  walk(graph.start, 0);
  return rows;
}

// ================================================================ layout & highlighting
/** Positions from `graph.layout`, else a top-down layered auto layout. */
export function layoutOf(graph: Graph): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  const level = new Map<string, number>();
  const queue: string[] = graph.start ? [graph.start] : [];
  if (graph.start) level.set(graph.start, 0);
  while (queue.length) {
    const id = queue.shift() as string;
    const node = nodeById(graph, id);
    for (const e of node ? edgesOf(node) : []) {
      if (!level.has(e.to)) {
        level.set(e.to, (level.get(id) ?? 0) + 1);
        queue.push(e.to);
      }
    }
  }
  const perLevel = new Map<number, number>();
  for (const n of graph.nodes) {
    const saved = graph.layout?.[n.id];
    if (saved) {
      out[n.id] = saved;
      continue;
    }
    const l = level.get(n.id) ?? perLevel.size + 1;
    const col = perLevel.get(l) ?? 0;
    perLevel.set(l, col + 1);
    out[n.id] = { x: col * 280, y: l * 150 };
  }
  return out;
}

/** Nodes and edges (`from:field`) walked by a dry run, for canvas highlighting. */
export function pathHighlight(graph: Graph, path: readonly PathStep[]): { nodes: Set<string>; edges: Set<string> } {
  const nodes = new Set(path.map((p) => p.node_id));
  const edges = new Set<string>();
  for (let i = 0; i + 1 < path.length; i++) {
    const node = nodeById(graph, path[i].node_id);
    if (!node) continue;
    for (const e of edgesOf(node)) if (e.to === path[i + 1].node_id) edges.add(`${e.from}:${e.field}`);
  }
  return { nodes, edges };
}

export function approvalBranches(node: ApprovalNode): string[] {
  return handlesOf(node).map((h) => h.label);
}

// ================================================================ undo / redo
export type History<T> = { past: T[]; present: T; future: T[] };

export function historyOf<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

export function push<T>(h: History<T>, next: T, limit = 50): History<T> {
  if (Object.is(next, h.present)) return h;
  return { past: [...h.past, h.present].slice(-limit), present: next, future: [] };
}

export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}

/** An empty new rule: one end node. */
export function emptyGraph(): Graph {
  return { start: "end", nodes: [{ id: "end", type: "end" }], layout: { end: { x: 0, y: 0 } } };
}
