/**
 * Phase 4 Epic 65 (governance, agent settings, evaluations) API types, mirroring the Epic 65 backend contract.
 * Hand-written like `agentic-types.ts` (the generated schema still carries the Epic 36 drift).
 */
import type { AgentCatalogOut, AgenticStateOut, RunOut, RunStatus, ToolCallOut } from "./agentic-types";

export interface GovernanceSummaryOut {
  runs_today: Partial<Record<RunStatus, number>>;
  pending_proposals: number;
  violations_7d: number;
  kill_switch: AgenticStateOut;
  burn_in_agents: string[];
}

export interface TimelineEntry {
  at: string;
  kind: "status" | "model_call" | "tool_call" | "proposal" | "decision";
  ref: string | null;
  label: string;
}

export interface RunStepDetail {
  step_no: number;
  status: string;
  stop_reason: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
  ai_action_id: string | null;
  model_tier: string | null;
  cache_read_tokens: number | null;
  cost_micros: number | null;
}

/** `GET /ai-governance/runs/{id}`: the foundation run plus cost, privacy flags and the timeline. */
export interface RunDetailOut extends Omit<RunOut, "steps"> {
  cost_usd: string;
  payload_available: boolean;
  copilot_private: boolean;
  timeline: TimelineEntry[];
  steps: RunStepDetail[];
  tool_calls: ToolCallOut[];
}

export interface PayloadItemOut {
  kind: string;
  step_no: number;
  tool_call_id: string | null;
  content: unknown;
  sha256: string;
  created_at: string;
}

export interface RunPayloadOut {
  run_id: string;
  items: PayloadItemOut[];
}

export interface ToolCallRow {
  id: string;
  run_id: string;
  agent_key: string;
  step_no: number;
  tool_key: string;
  risk: string;
  mode: string;
  mode_reason: string;
  outcome: string;
  error_code: string | null;
  target_type: string | null;
  target_id: string | null;
  proposal_id: string | null;
  egress: boolean;
  created_at: string;
}

export type ViolationKind = "refused_tool" | "injection_detected" | "possible_cross_scope";

export interface ViolationRow {
  kind: ViolationKind;
  run_id: string;
  agent_key: string;
  tool_key: string | null;
  error_code: string | null;
  mode_reason: string | null;
  tainted: boolean;
  created_at: string;
}

export interface CostRow {
  key: string;
  runs: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cost_micros: number;
  cost_usd: string;
}

export interface AgentBudgetRow {
  agent_key: string;
  agent_name: string;
  monthly_token_budget: number | null;
  used_this_month: number;
  pct_used: number | null;
  expected_cost_per_run_micros: number | null;
  actual_cost_per_run_micros: number | null;
}

export interface CostsOut {
  group_by: "agent" | "day" | "month";
  rows: CostRow[];
  totals: CostRow;
  month: { tokens: number; cost_usd: string; runs: number };
  tenant_monthly_token_budget: number | null;
  agents: AgentBudgetRow[];
  series?: { day: string; agent_key: string; cost_usd: string }[];
}

export interface EvalScore {
  score: string;
  threshold: string;
  passed: boolean;
  created_at: string;
  model: string | null;
  prompt_ref: string | null;
}

export interface EvalRowOut {
  agent_key: string;
  agent_name: string;
  agent_version: number | string;
  prompt_ref: string | null;
  model: string | null;
  offline: EvalScore | null;
  live: EvalScore | null;
  redteam: { cases_total: number; cases_passed: number } | null;
  threshold: string;
  status: "passing" | "below_threshold" | "not_run";
  failing_case_ids: string[];
  last_run_at: string | null;
}

export type ChecklistStatus = "ready" | "missing" | "warning" | "not_applicable";

export interface ChecklistItem {
  key: string;
  label: string;
  status: ChecklistStatus;
  detail: string;
  fix_link: string | null;
  blocking: boolean;
}

export interface ChecklistOut {
  agent_key: string;
  ready: boolean;
  items: ChecklistItem[];
}

export interface AgentLimitsOut {
  ceiling: Record<string, number>;
  tenant_monthly_token_budget: number | null;
}

/**
 * `AgentCatalogOut` plus the optional config fields the settings page edits. The foundation `AgentCatalogOut` does not
 * (yet) echo channels / working hours / expiry / trigger descriptions; the page tolerates their absence.
 */
export type AgentCatalogDetail = Omit<AgentCatalogOut, "triggers"> & {
  channels?: string[] | null;
  /** Channels the agent declares (the checkboxes shown). */
  declared_channels?: string[] | null;
  working_hours?: WorkingHours | null;
  proposal_expiry_hours?: number | null;
  triggers: { key: string; kind: string; enabled: boolean; description?: string | null }[];
};

export interface WorkingHours {
  days: string[];
  from: string;
  to: string;
  time_zone: string;
}

/** `PATCH /agents/{key}` body (`AgentConfigIn`). */
export interface AgentConfigIn {
  default_mode?: "off" | "suggest" | "auto" | null;
  monthly_token_budget?: number | null;
  limits?: Record<string, number> | null;
  triggers_enabled?: Record<string, boolean> | null;
  channels?: string[] | null;
  working_hours?: WorkingHours | null;
  proposal_expiry_hours?: number | null;
}

/** `AgenticStateOut` plus who accepted the notice (optional; shown when the server sends it). */
export type AgenticStateDetail = AgenticStateOut & { enabled_by?: string | null; enabled_by_name?: string | null };

export interface SelectionPointOut {
  key: string;
  label: string;
  definition: string;
  available: boolean;
}
