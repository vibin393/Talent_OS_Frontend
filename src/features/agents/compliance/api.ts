/** Epic 62 Compliance / BGV agent client (`/compliance/pre-start-risk`, `/candidates|placements/{id}/chases`,
 * `/bgv/cases/{id}/follow-ups`; "Chase now" / "Follow up now" start runs through `/agent-runs`). */
import { api } from "@/lib/api/client";
import type { CaseFollowUpsOut, ChaseOut, RiskListOut, RunRef } from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";

function idempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${crypto.randomUUID()}`;
}

export interface RiskQuery {
  days: number;
  clientId?: string | null;
  escalatedOnly?: boolean;
}

export function riskQuery(q: RiskQuery): string {
  const p = new URLSearchParams({ days: String(q.days) });
  if (q.clientId) p.set("client_id", q.clientId);
  if (q.escalatedOnly) p.set("escalated_only", "true");
  return p.toString();
}

export const complianceAgentApi = {
  risk: (q: RiskQuery, signal?: AbortSignal) => api.get<RiskListOut>(`${V}/compliance/pre-start-risk?${riskQuery(q)}`, { signal }),
  candidateChases: (id: string, signal?: AbortSignal) => api.get<ChaseOut[]>(`${V}/candidates/${enc(id)}/chases`, { signal }),
  placementChases: (id: string, signal?: AbortSignal) => api.get<ChaseOut[]>(`${V}/placements/${enc(id)}/chases`, { signal }),
  caseFollowUps: (id: string, signal?: AbortSignal) => api.get<CaseFollowUpsOut>(`${V}/bgv/cases/${enc(id)}/follow-ups`, { signal }),
  chaseNow: (candidateId: string) =>
    api.post<RunRef>(
      `${V}/agent-runs`,
      { agent_key: "compliance", subject_type: "candidate", subject_id: candidateId },
      { headers: { "Idempotency-Key": idempotencyKey() } },
    ),
  followUpNow: (caseId: string) =>
    api.post<RunRef>(
      `${V}/agent-runs`,
      { agent_key: "bgv", subject_type: "bgv_case", subject_id: caseId },
      { headers: { "Idempotency-Key": idempotencyKey() } },
    ),
};

export const complianceAgentKeys = {
  risk: (q: RiskQuery) => ["compliance-agent", "risk", q] as const,
  candidate: (id: string) => ["compliance-agent", "candidate-chases", id] as const,
  placement: (id: string) => ["compliance-agent", "placement-chases", id] as const,
  bgv: (id: string) => ["compliance-agent", "bgv-follow-ups", id] as const,
};
