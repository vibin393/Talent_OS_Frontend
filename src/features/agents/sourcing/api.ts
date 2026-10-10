/** Epic 56 Sourcing Agent client: the agent shortlist, entry decisions, manual runs, settings and outreach Proposals. */
import { api } from "@/lib/api/client";
import type { ProposalDecisionIn, ProposalOut } from "@/lib/api/agentic-types";
import type {
  EntryDecisionIn,
  EntryOut,
  ShortlistEnvelope,
  ShortlistVersionOut,
  SourcingRunOut,
  SourcingSettingsIn,
  SourcingSettingsOut,
} from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export const sourcingApi = {
  shortlist: (demandId: string, version?: number | null, signal?: AbortSignal) =>
    api.get<ShortlistEnvelope>(`${V}/demands/${enc(demandId)}/agent-shortlist${version ? `?version=${version}` : ""}`, { signal }),
  versions: (demandId: string, signal?: AbortSignal) =>
    api.get<ShortlistVersionOut[]>(`${V}/demands/${enc(demandId)}/agent-shortlist/versions`, { signal }),
  run: (demandId: string) =>
    api.post<SourcingRunOut>(`${V}/demands/${enc(demandId)}/sourcing-runs`, undefined, { headers: { "Idempotency-Key": newIdempotencyKey() } }),
  decide: (entryId: string, body: EntryDecisionIn) => api.post<EntryOut>(`${V}/agent-shortlist-entries/${enc(entryId)}/decision`, body),
  settings: (signal?: AbortSignal) => api.get<SourcingSettingsOut>(`${V}/settings/agents/sourcing`, { signal }),
  updateSettings: (body: SourcingSettingsIn) => api.put<SourcingSettingsOut>(`${V}/settings/agents/sourcing`, body),
  // Proposals (Epic 53 endpoints; Epic 65 builds the inbox)
  proposal: (id: string, signal?: AbortSignal) => api.get<ProposalOut>(`${V}/proposals/${enc(id)}`, { signal }),
  decideProposal: (id: string, body: ProposalDecisionIn) =>
    api.post<ProposalOut>(`${V}/proposals/${enc(id)}/decide`, body, { headers: { "Idempotency-Key": newIdempotencyKey() } }),
  bulkDecide: (proposalIds: string[], decision: "approve" | "reject", note?: string) =>
    api.post<ProposalOut[]>(
      `${V}/proposals/bulk-decide`,
      { proposal_ids: proposalIds, decision, note: note ?? null },
      { headers: { "Idempotency-Key": newIdempotencyKey() } },
    ),
};

export const sourcingKeys = {
  all: ["sourcing-agent"] as const,
  shortlist: (demandId: string, version: number | null) => ["sourcing-agent", "shortlist", demandId, version ?? "current"] as const,
  versions: (demandId: string) => ["sourcing-agent", "versions", demandId] as const,
  settings: ["sourcing-agent", "settings"] as const,
  proposal: (id: string) => ["sourcing-agent", "proposal", id] as const,
};
