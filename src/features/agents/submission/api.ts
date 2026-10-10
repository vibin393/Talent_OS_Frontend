/** Epic 61 Submission Agent client (`/api/v1/applications/{id}/submission-pack*`, `/submission-packs*`, client rules). */
import { api } from "@/lib/api/client";
import type {
  ClientSubmissionRulesIn,
  ClientSubmissionRulesOut,
  PackAgentStatusOut,
  PackCheckDetail,
  PackDetailOut,
  PackMetricsOut,
  PackPage,
  PackPatchIn,
  PackRatesIn,
  RunRef,
} from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface PackListQuery {
  status?: string | null;
  lifecycle?: string | null;
  clientId?: string | null;
  page?: number;
  pageSize?: number;
}

export function packListQuery(q: PackListQuery): string {
  const params = new URLSearchParams();
  if (q.status) params.set("status", q.status);
  if (q.lifecycle) params.set("lifecycle", q.lifecycle);
  if (q.clientId) params.set("client_id", q.clientId);
  params.set("page", String(q.page ?? 1));
  params.set("page_size", String(q.pageSize ?? 25));
  return params.toString();
}

export const submissionPacksApi = {
  forApplication: (applicationId: string, signal?: AbortSignal) =>
    api.get<PackDetailOut>(`${V}/applications/${enc(applicationId)}/submission-pack`, { signal }),
  prepareWithoutAi: (applicationId: string) =>
    api.post<PackDetailOut>(`${V}/applications/${enc(applicationId)}/submission-pack`),
  refreshChecks: (applicationId: string, rates?: PackRatesIn | null) =>
    api.post<{ checks: PackCheckDetail[] }>(`${V}/applications/${enc(applicationId)}/submission-pack/checks`, { rates: rates ?? null }),
  startAgent: (applicationId: string) =>
    api.post<RunRef>(
      `${V}/agent-runs`,
      { agent_key: "submission", subject_type: "application", subject_id: applicationId },
      { headers: { "Idempotency-Key": newIdempotencyKey() } },
    ),
  agentStatus: (signal?: AbortSignal) => api.get<PackAgentStatusOut>(`${V}/submission-packs/agent-status`, { signal }),
  get: (packId: string, signal?: AbortSignal) => api.get<PackDetailOut>(`${V}/submission-packs/${enc(packId)}`, { signal }),
  list: (q: PackListQuery, signal?: AbortSignal) => api.get<PackPage>(`${V}/submission-packs?${packListQuery(q)}`, { signal }),
  metrics: (signal?: AbortSignal) => api.get<PackMetricsOut>(`${V}/submission-packs/metrics`, { signal }),
  patch: (packId: string, body: PackPatchIn) => api.patch<PackDetailOut>(`${V}/submission-packs/${enc(packId)}`, body),
  opened: (packId: string) => api.post<PackDetailOut>(`${V}/submission-packs/${enc(packId)}/opened`),
  discard: (packId: string, reason = "user_discarded") =>
    api.post<PackDetailOut>(`${V}/submission-packs/${enc(packId)}/discard`, { reason }),
  rules: (clientId: string, signal?: AbortSignal) =>
    api.get<ClientSubmissionRulesOut>(`${V}/clients/${enc(clientId)}/submission-rules`, { signal }),
  saveRules: (clientId: string, body: ClientSubmissionRulesIn) =>
    api.put<ClientSubmissionRulesOut>(`${V}/clients/${enc(clientId)}/submission-rules`, body),
};

export const submissionPackKeys = {
  all: ["submission-packs"] as const,
  forApplication: (applicationId: string) => ["submission-packs", "application", applicationId] as const,
  status: ["submission-packs", "agent-status"] as const,
  list: (q: PackListQuery) => ["submission-packs", "list", q] as const,
  metrics: ["submission-packs", "metrics"] as const,
  rules: (clientId: string) => ["submission-packs", "rules", clientId] as const,
};
