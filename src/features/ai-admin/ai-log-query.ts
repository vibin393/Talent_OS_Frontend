/** Pure query helpers for the AI action log (`/admin/ai/log`). */

/** One `ai_actions` row as returned by `GET /api/v1/ai/actions` (untyped `dict` in the OpenAPI document). */
export type AiActionRow = {
  id: string;
  feature: string;
  prompt_id: string | null;
  prompt_version: string | null;
  model: string | null;
  initiator_type: string | null;
  initiator_id: string | null;
  subject_type: string | null;
  subject_id: string | null;
  input_ref: string | null;
  status: string;
  error_code: string | null;
  output: unknown;
  limitations_note: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  consent_basis: string | null;
  decision: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  // Epic 65: agent steps in the action log.
  kind?: "single" | "agent_step" | null;
  agent_key?: string | null;
  agent_run_id?: string | null;
  step_no?: number | null;
  model_tier?: string | null;
  cost_micros?: number | null;
  run_link?: string | null;
};

export type AiLogFilters = {
  feature: string | null;
  initiatorId: string | null;
  initiatorLabel?: string;
  subjectType: string | null;
  subjectId: string;
  decision: string | null;
  status: string | null;
  from: string;
  to: string;
  /** Epic 65: "single" (One-shot) / "agent_step" (Agent step). */
  kind?: string | null;
  agentKey?: string | null;
  /** Epic 65: "Run or AI action id" search (a full id). */
  search?: string;
};

export const AI_LOG_KINDS = ["single", "agent_step"] as const;
export const AI_LOG_KIND_LABELS: Record<string, string> = { single: "One-shot", agent_step: "Agent step" };

export const EMPTY_AI_LOG_FILTERS: AiLogFilters = {
  feature: null,
  initiatorId: null,
  subjectType: null,
  subjectId: "",
  decision: null,
  status: null,
  from: "",
  to: "",
};

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Query string for the AI action log / CSV export. Dates are whole local days (`to` is inclusive). */
export function aiLogQuery(f: AiLogFilters, page?: number, pageSize?: number): string {
  const p = new URLSearchParams();
  if (page !== undefined) p.set("page", String(page));
  if (pageSize !== undefined) p.set("page_size", String(pageSize));
  if (f.feature) p.set("feature", f.feature);
  if (f.initiatorId) p.set("initiator_id", f.initiatorId);
  if (f.subjectType) p.set("subject_type", f.subjectType);
  if (UUID_RE.test(f.subjectId.trim())) p.set("subject_id", f.subjectId.trim());
  if (f.decision) p.set("decision", f.decision);
  if (f.status) p.set("status", f.status);
  if (f.kind) p.set("kind", f.kind);
  if (f.agentKey) p.set("agent_key", f.agentKey);
  if (f.search && UUID_RE.test(f.search.trim())) p.set("agent_run_id", f.search.trim());
  if (f.from) p.set("from", new Date(`${f.from}T00:00:00`).toISOString());
  if (f.to) {
    const end = new Date(`${f.to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    p.set("to", end.toISOString());
  }
  return p.toString();
}

