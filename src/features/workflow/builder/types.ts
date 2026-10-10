import type { WorkflowExecutionOut, WorkflowRegistryOut, WorkflowRuleOut, WorkflowTriggerOut } from "@/lib/api/types";

/**
 * Epic 32 workflow v2 graph types. Hand-written mirrors of the backend `graph.py` JSON and the RuleOut /
 * RegistryOut / DryRunOut additions until `npm run gen:api` runs against a backend with Epic 32.
 */

export type DurationUnit = "minutes" | "hours" | "days" | "business_hours" | "business_days";
export type Duration = { value: number; unit: DurationUnit };
export type ApproverKind = "user" | "role" | "entity_owner" | "primary_recruiter";

export type ConditionNode = { id: string; type: "condition"; when: Record<string, unknown>; then?: string | null; else?: string | null };
export type DelayNode = { id: string; type: "delay"; duration: Duration; next?: string | null };
export type ApprovalNode = {
  id: string;
  type: "approval";
  title: string;
  approver: { kind: ApproverKind; ref?: string | null };
  escalation_policy_id?: string | null;
  timeout?: Duration | null;
  on_approved?: string | null;
  on_rejected?: string | null;
  on_timeout?: string | null;
};
export type ActionNode = { id: string; type: "action"; action: { type: string; params: Record<string, unknown> }; next?: string | null };
export type EndNode = { id: string; type: "end" };
export type GraphNode = ConditionNode | DelayNode | ApprovalNode | ActionNode | EndNode;
export type NodeType = GraphNode["type"];
export type Graph = { start: string; nodes: GraphNode[]; layout?: Record<string, { x: number; y: number }> };

export type OutlineRow = { depth: number; node_id: string; kind: string; text: string };
export type PathStep = { node_id: string; type: string; outcome: string; scheduled_at?: string | null };

export type GraphRuleOut = WorkflowRuleOut & {
  graph: Graph;
  definition_version: number;
  outline: OutlineRow[];
  step_count: number;
  is_p1_form: boolean;
  waiting_runs: number;
};

export type GraphTriggerOut = WorkflowTriggerOut & {
  group?: string;
  owner_epic?: string | null;
  /** Epic 48: when non-null, the only action types this trigger's rules may use. */
  allowed_actions?: string[] | null;
};

export type GraphRegistryOut = Omit<WorkflowRegistryOut, "triggers"> & {
  triggers: GraphTriggerOut[];
  node_types?: string[];
  delay_units?: string[];
  approver_kinds?: string[];
  max_steps?: number;
  contract_actions?: { type: string; owner_epic: string; available: boolean }[];
  escalation_policies?: { id: string; name: string }[];
};

export type GraphExecutionOut = WorkflowExecutionOut & {
  node_trace?: { node_id: string; type: string; status: string; detail: unknown; at: string }[];
  waits?: { id: string; node_id: string; kind: string; status: string; outcome: string | null; resume_at: string | null; timeout_at: string | null }[];
};

export type GraphRuleBody = { name: string; description: string | null; trigger: string; graph: Graph };
export type GraphDryRunOut = {
  matched: boolean;
  entity_type: string;
  entity_id: string;
  condition_trace: Record<string, unknown>[];
  action_results: Record<string, unknown>[];
  execution_id: string | null;
  note: string;
  path: PathStep[];
};
