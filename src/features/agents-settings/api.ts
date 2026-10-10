/** Agent settings client (foundation `/agents`, `/ai/agentic`; Epic 65 checklist, burn-in, limits). */
"use client";

import { useQuery } from "@tanstack/react-query";
import type { AgenticStateOut, AutonomyMode } from "@/lib/api/agentic-types";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { AgentCatalogDetail, AgentConfigIn, AgentLimitsOut, ChecklistOut } from "@/lib/api/governance-types";

const V = "/api/v1";
const enc = encodeURIComponent;

export const agentsApi = {
  list: (signal?: AbortSignal) => api.get<AgentCatalogDetail[]>(`${V}/agents`, { signal }),
  enableAgentic: (noticeVersion: string) => api.post<AgenticStateOut>(`${V}/ai/agentic/enable`, { notice_version: noticeVersion }),
  setEnabled: (key: string, enabled: boolean) => api.put<AgentCatalogDetail>(`${V}/agents/${enc(key)}/enabled`, { enabled }),
  patch: (key: string, body: AgentConfigIn) => api.patch<AgentCatalogDetail>(`${V}/agents/${enc(key)}`, body),
  setAction: (key: string, tool: string, mode: AutonomyMode, routeRoleKey: string | null) =>
    api.put<AgentCatalogDetail>(`${V}/agents/${enc(key)}/actions/${enc(tool)}`, { mode, route_role_key: routeRoleKey }),
  checklist: (key: string, signal?: AbortSignal) => api.get<ChecklistOut>(`${V}/agents/${enc(key)}/checklist`, { signal }),
  acknowledge: (key: string, reason: string) => api.post<void>(`${V}/agents/${enc(key)}/checklist/acknowledge`, { reason }),
  endBurnIn: (key: string, reason: string) => api.post<AgentCatalogDetail>(`${V}/agents/${enc(key)}/burn-in/end`, { reason }),
  limits: (key: string, signal?: AbortSignal) => api.get<AgentLimitsOut>(`${V}/agents/${enc(key)}/limits`, { signal }),
  tools: (signal?: AbortSignal) => api.get<{ key: string; title: string; description: string }[]>(`${V}/agents/tools`, { signal }),
};

export const agentsKeys = {
  list: ["agents", "catalog"] as const,
  checklist: (key: string) => ["agents", "checklist", key] as const,
  limits: (key: string) => ["agents", "limits", key] as const,
  tools: ["agents", "tools"] as const,
};

const noDeniedRetry = (count: number, e: unknown) => count < 1 && !(isApiError(e) && (e.status === 403 || e.status === 404));

export function useChecklist(key: string, enabled = true) {
  return useQuery({
    queryKey: agentsKeys.checklist(key),
    queryFn: ({ signal }) => agentsApi.checklist(key, signal),
    enabled,
    retry: noDeniedRetry,
    staleTime: 60_000,
  });
}

export function useAgentsList(enabled = true) {
  return useQuery({ queryKey: agentsKeys.list, queryFn: ({ signal }) => agentsApi.list(signal), enabled, retry: noDeniedRetry });
}
