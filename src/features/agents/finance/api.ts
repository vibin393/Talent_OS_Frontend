/** Epic 63 client: timesheet flags (`/timesheets/{id}/flags`, `/timesheet-flags*`), collection rules / holds / plan /
 * agent log (`/collections/*`, `/invoices/{id}/agent-log`) and the Billing Agent start (`/billing/prepare-run`).
 * "Run collections now" starts a run through the foundation's `/agent-runs`. */
import type { RunOut } from "@/lib/api/agentic-types";
import { api } from "@/lib/api/client";
import type { AgentStateOut, CollectionPlanOut, FlagCount, FlagOut, HoldOut, LogOut, RuleIn, RuleOut, RunRef, StepIn } from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";

function idempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${crypto.randomUUID()}`;
}

export interface HoldIn {
  client_id: string;
  document_kind?: "invoice" | "debit_note" | null;
  document_id?: string | null;
  mode: "paused" | "takeover";
  reason?: string | null;
}

export interface PrepareRunIn {
  legal_entity_id: string;
  period_start: string;
  period_end: string;
  client_id?: string | null;
}

export const financeAgentApi = {
  flags: (timesheetId: string, signal?: AbortSignal) => api.get<FlagOut[]>(`${V}/timesheets/${enc(timesheetId)}/flags`, { signal }),
  flagCounts: (ids: string[], signal?: AbortSignal) =>
    ids.length
      ? api.get<FlagCount[]>(`${V}/timesheet-flags/counts?${ids.map((i) => `timesheet_ids=${enc(i)}`).join("&")}`, { signal })
      : Promise.resolve([] as FlagCount[]),
  reviewFlag: (flagId: string, status: "reviewed" | "dismissed", note?: string) =>
    api.post<FlagOut>(`${V}/timesheet-flags/${enc(flagId)}/review`, { status, note: note || null }),
  nudgeNow: () => api.post<RunRef>(`${V}/timesheet-flags/nudge-now`, undefined, { headers: { "Idempotency-Key": idempotencyKey() } }),

  rules: (signal?: AbortSignal) => api.get<RuleOut[]>(`${V}/collections/rules`, { signal }),
  rule: (id: string, signal?: AbortSignal) => api.get<RuleOut>(`${V}/collections/rules/${enc(id)}`, { signal }),
  createRule: (body: RuleIn) => api.post<RuleOut>(`${V}/collections/rules`, body),
  updateRule: (id: string, body: Partial<RuleIn>) => api.put<RuleOut>(`${V}/collections/rules/${enc(id)}`, body),
  putSteps: (id: string, steps: StepIn[]) => api.put<RuleOut>(`${V}/collections/rules/${enc(id)}/steps`, { steps }),
  deleteRule: (id: string) => api.delete<void>(`${V}/collections/rules/${enc(id)}`),

  plan: (clientId: string, signal?: AbortSignal) => api.get<CollectionPlanOut>(`${V}/collections/clients/${enc(clientId)}/plan`, { signal }),
  state: (clientId: string, signal?: AbortSignal) => api.get<AgentStateOut>(`${V}/collections/clients/${enc(clientId)}/agent-state`, { signal }),
  clientLog: (clientId: string, signal?: AbortSignal) => api.get<LogOut[]>(`${V}/collections/clients/${enc(clientId)}/agent-log`, { signal }),
  invoiceLog: (invoiceId: string, signal?: AbortSignal) => api.get<LogOut[]>(`${V}/invoices/${enc(invoiceId)}/agent-log`, { signal }),
  hold: (body: HoldIn) => api.post<HoldOut>(`${V}/collections/holds`, body),
  release: (holdId: string) => api.post<HoldOut>(`${V}/collections/holds/${enc(holdId)}/release`),
  runCollections: (clientId: string) =>
    api.post<RunRef>(
      `${V}/agent-runs`,
      { agent_key: "collections", subject_type: "client", subject_id: clientId },
      { headers: { "Idempotency-Key": idempotencyKey() } },
    ),

  prepareRun: (body: PrepareRunIn) => api.post<RunRef>(`${V}/billing/prepare-run`, body, { headers: { "Idempotency-Key": idempotencyKey() } }),
  run: (runId: string, signal?: AbortSignal) => api.get<RunOut>(`${V}/agent-runs/${enc(runId)}`, { signal }),
};

export const financeAgentKeys = {
  flags: (id: string) => ["finance-agents", "flags", id] as const,
  flagCounts: (ids: string[]) => ["finance-agents", "flag-counts", ids] as const,
  rules: () => ["finance-agents", "rules"] as const,
  rule: (id: string) => ["finance-agents", "rule", id] as const,
  plan: (clientId: string) => ["finance-agents", "plan", clientId] as const,
  state: (clientId: string) => ["finance-agents", "state", clientId] as const,
  clientLog: (clientId: string) => ["finance-agents", "client-log", clientId] as const,
  run: (runId: string) => ["finance-agents", "run", runId] as const,
};
