/** Proposal inbox client (foundation `/proposals`, Epic 65 `opened` signal, foundation `POST /agent-runs`). */
"use client";

import { useQuery } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import type { ProposalOut } from "@/lib/api/agentic-types";
import { api } from "@/lib/api/client";
import type { Page } from "@/lib/api/types";
import { newIdempotencyKey } from "@/features/ai-governance/api";

const V = "/api/v1";
const enc = encodeURIComponent;

/** `ProposalOut` plus the creation time used for ageing (sent by the Epic 65 backend). */
export type InboxProposal = ProposalOut & { created_at?: string | null };

export const inboxApi = {
  list: (query: string, signal?: AbortSignal) => api.get<Page<InboxProposal>>(`${V}/proposals?${query}`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<InboxProposal>(`${V}/proposals/${enc(id)}`, { signal }),
  decide: (id: string, body: { decision: "approve" | "reject"; note?: string | null; edited_args?: Record<string, unknown> | null }) =>
    api.post<InboxProposal>(`${V}/proposals/${enc(id)}/decide`, body, { headers: { "Idempotency-Key": newIdempotencyKey() } }),
  bulkDecide: (ids: string[], decision: "approve" | "reject", note: string | null) =>
    api.post<InboxProposal[]>(
      `${V}/proposals/bulk-decide`,
      { proposal_ids: ids, decision, note },
      { headers: { "Idempotency-Key": newIdempotencyKey() } },
    ),
  opened: (id: string) => api.post<void>(`${V}/ai-governance/proposals/${enc(id)}/opened`),
  rerun: (agentKey: string, subjectType: string, subjectId: string) =>
    api.post<unknown>(
      `${V}/agent-runs`,
      { agent_key: agentKey, subject_type: subjectType, subject_id: subjectId },
      { headers: { "Idempotency-Key": newIdempotencyKey() } },
    ),
};

export const inboxKeys = {
  all: ["proposals"] as const,
  list: (q: string) => ["proposals", "inbox", q] as const,
  one: (id: string) => ["proposals", "one", id] as const,
  count: ["proposals", "mine-count"] as const,
};

/** Pending Proposals assigned to me + my queues (nav `CounterBadge`), polled every 60 s. */
export function useMyProposalsCount(): number {
  const decide = usePermission("proposal:decide");
  const govern = usePermission("ai:govern");
  const q = useQuery({
    queryKey: inboxKeys.count,
    queryFn: ({ signal }) => inboxApi.list("status=pending&mine=true&page_size=1", signal),
    enabled: decide || govern,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });
  return q.data?.total ?? 0;
}
