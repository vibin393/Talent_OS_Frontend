/**
 * Phase 4 (Epic 53) API types, mirroring `app/schemas/agentic.py` exactly. Hand-written because `npm run gen:api` still
 * regenerates the whole schema with the pre-existing drift recorded in Epic 36 (deferred work); replace with the
 * generated `components["schemas"][...]` once that drift is fixed.
 */

export type AutonomyMode = "off" | "suggest" | "auto";
export type RiskClass = "read" | "low" | "high";
export type RunStatus = "queued" | "running" | "waiting" | "completed" | "stopped" | "failed" | "cancelled";
export type ProposalStatus =
  | "pending"
  | "approved"
  | "executed"
  | "execution_failed"
  | "rejected"
  | "expired"
  | "stale"
  | "discarded";

/** Plain-text preview of a Proposal; rendered as text, never HTML. `fields` are [label, value] pairs. */
export interface ProposalPreview {
  title: string;
  summary: string;
  fields: [string, string][];
  renderer: string | null;
}

export interface ProposalOut {
  id: string;
  human_id: string;
  origin: "agent" | "copilot";
  agent_key: string;
  agent_name: string;
  tool_key: string;
  tool_title: string;
  title: string;
  preview: ProposalPreview;
  risk: "low" | "high";
  rationale: string | null;
  confidence: string | null;
  evidence: { type: string; id: string; label?: string }[];
  target_type: string | null;
  target_id: string | null;
  status: ProposalStatus;
  edited: boolean;
  assignee_user_id: string | null;
  route_role_key: string | null;
  owner_user_id: string;
  expires_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  executed_at: string | null;
  error_code: string | null;
  run_id: string | null;
  can_decide: boolean;
  args: Record<string, unknown> | null;
  input_schema: Record<string, unknown> | null;
}

export interface ProposalDecisionIn {
  decision: "approve" | "reject";
  note?: string | null;
  edited_args?: Record<string, unknown> | null;
}

export interface RunSummary {
  id: string;
  agent_key: string;
  agent_name: string;
  origin: "agent" | "copilot" | "conversation";
  trigger_kind: string;
  trigger_key: string | null;
  status: RunStatus;
  reason_code: string | null;
  subject_type: string | null;
  subject_id: string | null;
  owner_user_id: string;
  actor_label: string;
  step_count: number;
  tool_call_count: number;
  input_tokens: number;
  output_tokens: number;
  cost_micros: number;
  tainted: boolean;
  policy_violations: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  queue_age_seconds: number | null;
}

export interface ToolCallOut {
  id: string;
  step_no: number;
  tool_key: string;
  tool_version: number;
  risk: RiskClass;
  mode: AutonomyMode;
  mode_reason: string;
  outcome: string;
  error_code: string | null;
  proposal_id: string | null;
  egress: boolean;
  target_type: string | null;
  target_id: string | null;
  args_redacted: Record<string, unknown> | null;
  result_summary: string | null;
  latency_ms: number | null;
}

export interface RunOut extends RunSummary {
  related_refs: [string, string][];
  candidate_ids: string[];
  limits: Record<string, number>;
  wait_condition: string | null;
  wait_until: string | null;
  result: Record<string, unknown> | null;
  fallback_task_id: string | null;
  steps: {
    step_no: number;
    status: string;
    stop_reason: string | null;
    input_tokens: number | null;
    output_tokens: number | null;
    latency_ms: number | null;
    ai_action_id: string | null;
  }[];
  tool_calls: ToolCallOut[];
  proposals: { id: string; human_id: string; tool_key: string; title: string; status: ProposalStatus; risk: string }[];
}

export interface AgentToolModeOut {
  key: string;
  title: string;
  risk: RiskClass;
  mode: AutonomyMode;
  mode_reason: string;
  route_role_key: string | null;
  permissions: string[];
}

export interface AgentCatalogOut {
  key: string;
  name: string;
  purpose: string;
  owner_epic: string;
  version: number;
  placeholder: boolean;
  enabled: boolean;
  model_tier: "fast" | "standard" | "deep";
  default_mode: AutonomyMode;
  burn_in_until: string | null;
  limits: Record<string, number>;
  monthly_token_budget: number | null;
  used_this_month: number;
  permission_ceiling: Record<string, string>;
  triggers: { key: string; kind: string; enabled: boolean }[];
  tools: AgentToolModeOut[];
  eval_set: string | null;
  eval_threshold: number;
}

export interface AgenticStateOut {
  enabled: boolean;
  notice_version: string | null;
  current_notice_version: string;
  enabled_at: string | null;
  kill_switch: boolean;
  kill_switch_at: string | null;
  reason: string | null;
  platform_kill_switch: boolean;
  global_kill_switch: boolean;
}
