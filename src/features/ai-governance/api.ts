/** Epic 65 AI governance console client (`/ai-governance/*`, foundation `/ai/*` and `/agent-runs/*`). */
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Page } from "@/lib/api/types";
import type { AgentCatalogOut, AgenticStateOut, RunOut, RunSummary } from "@/lib/api/agentic-types";
import type {
  AgenticStateDetail,
  CostsOut,
  EvalRowOut,
  GovernanceSummaryOut,
  RunDetailOut,
  RunPayloadOut,
  ViolationKind,
  ViolationRow,
} from "@/lib/api/governance-types";

const V = "/api/v1";
const enc = encodeURIComponent;

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(16)}-${crypto.randomUUID()}`;
}

export const governanceApi = {
  summary: (signal?: AbortSignal) => api.get<GovernanceSummaryOut>(`${V}/ai-governance/summary`, { signal }),
  runs: (query: string, signal?: AbortSignal) => api.get<Page<RunSummary>>(`${V}/ai-governance/runs?${query}`, { signal }),
  run: (id: string, signal?: AbortSignal) => api.get<RunDetailOut>(`${V}/ai-governance/runs/${enc(id)}`, { signal }),
  /** Foundation run read (owner or `ai:govern`), used when the console read is refused. */
  foundationRun: (id: string, signal?: AbortSignal) => api.get<RunOut>(`${V}/agent-runs/${enc(id)}`, { signal }),
  payload: (id: string, reason: string) => api.post<RunPayloadOut>(`${V}/agent-runs/${enc(id)}/payload`, { reason }),
  cancelRun: (id: string, reason: string) => api.post<unknown>(`${V}/agent-runs/${enc(id)}/cancel`, { reason, reason_code: "manual" }),
  violations: (kind: ViolationKind, query: string, signal?: AbortSignal) =>
    api.get<Page<ViolationRow>>(`${V}/ai-governance/violations?kind=${enc(kind)}${query ? `&${query}` : ""}`, { signal }),
  costs: (query: string, signal?: AbortSignal) => api.get<CostsOut>(`${V}/ai-governance/costs${query ? `?${query}` : ""}`, { signal }),
  evals: (signal?: AbortSignal) => api.get<EvalRowOut[]>(`${V}/ai-governance/evals`, { signal }),
  agentic: (signal?: AbortSignal) => api.get<AgenticStateDetail>(`${V}/ai/agentic`, { signal }),
  killSwitch: (on: boolean, reason: string | null) => api.post<AgenticStateOut>(`${V}/ai/kill-switch`, { on, reason }),
  agents: (signal?: AbortSignal) => api.get<AgentCatalogOut[]>(`${V}/agents`, { signal }),
};

export const governanceKeys = {
  all: ["ai-governance"] as const,
  summary: ["ai-governance", "summary"] as const,
  runs: (q: string) => ["ai-governance", "runs", q] as const,
  run: (id: string) => ["ai-governance", "run", id] as const,
  violations: (kind: string, q: string) => ["ai-governance", "violations", kind, q] as const,
  costs: (q: string) => ["ai-governance", "costs", q] as const,
  evals: ["ai-governance", "evals"] as const,
  agentic: ["ai", "agentic"] as const,
  agents: ["agents", "catalog"] as const,
};

function noRetryOnDenied(count: number, error: unknown): boolean {
  if (isApiError(error) && (error.status === 403 || error.status === 404)) return false;
  return count < 2;
}

/** The tenant's agentic state (master switch + kill switches). */
export function useAgenticState(enabled = true) {
  return useQuery({
    queryKey: governanceKeys.agentic,
    queryFn: ({ signal }) => governanceApi.agentic(signal),
    enabled,
    retry: noRetryOnDenied,
    staleTime: 30_000,
  });
}

/** The agent catalog (`GET /agents`); used for the "Agent" filters. Hidden quietly on 403. */
export function useAgentCatalog(enabled = true) {
  return useQuery({
    queryKey: governanceKeys.agents,
    queryFn: ({ signal }) => governanceApi.agents(signal),
    enabled,
    retry: noRetryOnDenied,
    staleTime: 60_000,
  });
}

export function useEvals(enabled = true) {
  return useQuery({ queryKey: governanceKeys.evals, queryFn: ({ signal }) => governanceApi.evals(signal), enabled, retry: noRetryOnDenied });
}
