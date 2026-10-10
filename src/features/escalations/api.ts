import { api } from "@/lib/api/client";
import type { ChainEscalationsIn, ChainEscalationsOut, EscalationPolicyIn, EscalationPolicyOut, EscalationWatchOut } from "./types";

const enc = encodeURIComponent;
const S = "/api/v1/sla";

/** Escalation policies, approval-chain step escalations and watch history (Epic 32, story 19.2). */
export const escalationsApi = {
  policies: (includeArchived: boolean, signal?: AbortSignal) =>
    api.get<EscalationPolicyOut[]>(`${S}/escalation-policies${includeArchived ? "?include_archived=true" : ""}`, { signal }),
  create: (body: EscalationPolicyIn) => api.post<EscalationPolicyOut>(`${S}/escalation-policies`, body),
  update: (id: string, body: Partial<EscalationPolicyIn>) => api.patch<EscalationPolicyOut>(`${S}/escalation-policies/${enc(id)}`, body),
  archive: (id: string) => api.post<EscalationPolicyOut>(`${S}/escalation-policies/${enc(id)}/archive`),
  chainSteps: (chainId: string, signal?: AbortSignal) => api.get<ChainEscalationsOut>(`${S}/approval-chains/${enc(chainId)}/escalations`, { signal }),
  setChainSteps: (chainId: string, body: ChainEscalationsIn) => api.put<ChainEscalationsOut>(`${S}/approval-chains/${enc(chainId)}/escalations`, body),
  watches: (subjectKind: "approval_step" | "task", subjectId: string, signal?: AbortSignal) =>
    api.get<EscalationWatchOut[]>(`${S}/escalations?subject_kind=${subjectKind}&subject_id=${enc(subjectId)}`, { signal }),
};

export const escalationKeys = {
  all: ["escalations"] as const,
  policies: (includeArchived: boolean) => ["escalations", "policies", includeArchived] as const,
  chain: (chainId: string) => ["escalations", "chain", chainId] as const,
};
