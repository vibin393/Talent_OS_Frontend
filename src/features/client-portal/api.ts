/**
 * Client Portal content API (Epic 18): `/api/v1/client-portal/*` through Epic 14's `clientPortalRequest`
 * (tos_client session). Timesheets (Epic 25) and invoices (Epic 29) keep their own clients.
 */
import { CLIENT_PORTAL_PREFIX, clientPortalRequest } from "@/lib/api/client-portal-client";
import { ApiError, toApiError } from "@/lib/api/errors";
import type {
  ApprovalDetailOut,
  ApprovalsHubOut,
  ClientApprovalLinkView,
  ClientCompareOut,
  ClientDemandRequestIn,
  ClientDemandRequestOut,
  ClientDemandSummary,
  ClientHomeOut,
  ClientPlacementDetail,
  ClientPlacementOut,
  ClientPoConsumptionOut,
  ClientScorecardItem,
  ClientSlotProposalOut,
  ClientSubmissionOut,
  ColleagueOut,
  CompliancePackOut,
  DelegationOut,
  FeedbackDecision,
  SlotIn,
} from "./types";

const P = CLIENT_PORTAL_PREFIX;
const enc = encodeURIComponent;

function idemKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `k-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const cpKeys = {
  home: ["client-portal", "home"] as const,
  demands: ["client-portal", "demands"] as const,
  demand: (id: string) => ["client-portal", "demands", id] as const,
  submissions: (demandId?: string) => ["client-portal", "submissions", demandId ?? "all"] as const,
  submission: (id: string) => ["client-portal", "submission", id] as const,
  compare: (ids: string[]) => ["client-portal", "compare", ...ids] as const,
  scorecards: ["client-portal", "scorecards"] as const,
  approvals: ["client-portal", "approvals"] as const,
  approval: (id: string) => ["client-portal", "approvals", id] as const,
  delegations: ["client-portal", "delegations"] as const,
  colleagues: ["client-portal", "colleagues"] as const,
  team: ["client-portal", "team"] as const,
  member: (id: string) => ["client-portal", "team", id] as const,
  pos: ["client-portal", "purchase-orders"] as const,
  packs: ["client-portal", "compliance-packs"] as const,
};

export const cpApi = {
  home: (signal?: AbortSignal) => clientPortalRequest<ClientHomeOut>(`${P}/home`, { signal }),
  demands: (signal?: AbortSignal) => clientPortalRequest<ClientDemandSummary[]>(`${P}/demands`, { signal }),
  demand: (id: string, signal?: AbortSignal) => clientPortalRequest<ClientDemandSummary>(`${P}/demands/${enc(id)}`, { signal }),
  requestDemand: (data: ClientDemandRequestIn, jd: File | null) => {
    const form = new FormData();
    form.append("payload", JSON.stringify(data));
    if (jd) form.append("jd", jd);
    return clientPortalRequest<ClientDemandRequestOut>(`${P}/demand-requests`, { method: "POST", body: form });
  },
  submissions: (demandId?: string, signal?: AbortSignal) =>
    clientPortalRequest<ClientSubmissionOut[]>(`${P}/submissions${demandId ? `?demand_id=${enc(demandId)}` : ""}`, { signal }),
  submission: (id: string, signal?: AbortSignal) => clientPortalRequest<ClientSubmissionOut>(`${P}/submissions/${enc(id)}`, { signal }),
  compare: (ids: string[]) =>
    clientPortalRequest<ClientCompareOut>(`${P}/submissions/compare`, { method: "POST", body: { submission_ids: ids } }),
  resumeUrl: (id: string) => `${P}/submissions/${enc(id)}/resume`,
  feedback: (id: string, decision: FeedbackDecision, comment: string | null) =>
    clientPortalRequest<ClientSubmissionOut>(`${P}/submissions/${enc(id)}/feedback`, { method: "POST", body: { decision, comment } }),
  proposeSlots: (id: string, slots: SlotIn[]) =>
    clientPortalRequest<ClientSlotProposalOut>(`${P}/submissions/${enc(id)}/slot-proposals`, { method: "POST", body: { slots } }),
  chooseSlot: (proposalId: string, index: number) =>
    clientPortalRequest<ClientSlotProposalOut>(`${P}/slot-offers/${enc(proposalId)}/choose`, { method: "POST", body: { index } }),
  scorecards: (signal?: AbortSignal) => clientPortalRequest<ClientScorecardItem[]>(`${P}/scorecards`, { signal }),
  approvals: (signal?: AbortSignal) => clientPortalRequest<ApprovalsHubOut>(`${P}/approvals`, { signal }),
  approval: (id: string, signal?: AbortSignal) => clientPortalRequest<ApprovalDetailOut>(`${P}/approvals/${enc(id)}`, { signal }),
  decide: (id: string, decision: "approve" | "reject", comment: string | null) =>
    clientPortalRequest<ApprovalDetailOut>(`${P}/approvals/${enc(id)}/decide`, {
      method: "POST",
      body: { decision, comment },
      headers: { "Idempotency-Key": idemKey() },
    }),
  delegations: (signal?: AbortSignal) => clientPortalRequest<DelegationOut[]>(`${P}/delegations`, { signal }),
  colleagues: (signal?: AbortSignal) => clientPortalRequest<ColleagueOut[]>(`${P}/delegations/colleagues`, { signal }),
  delegate: (delegateId: string, startsOn: string, endsOn: string) =>
    clientPortalRequest<DelegationOut>(`${P}/delegations`, {
      method: "POST",
      body: { delegate_client_user_id: delegateId, starts_on: startsOn, ends_on: endsOn },
    }),
  revokeDelegation: (id: string) => clientPortalRequest<DelegationOut>(`${P}/delegations/${enc(id)}/revoke`, { method: "POST" }),
  team: (signal?: AbortSignal) => clientPortalRequest<ClientPlacementOut[]>(`${P}/team`, { signal }),
  member: (id: string, signal?: AbortSignal) => clientPortalRequest<ClientPlacementDetail>(`${P}/team/${enc(id)}`, { signal }),
  purchaseOrders: (signal?: AbortSignal) => clientPortalRequest<ClientPoConsumptionOut[]>(`${P}/purchase-orders`, { signal }),
  packs: (signal?: AbortSignal) => clientPortalRequest<CompliancePackOut[]>(`${P}/compliance-packs`, { signal }),
  packItemUrl: (itemId: string) => `${P}/compliance-packs/items/${enc(itemId)}/download`,
};

/** Public `client_approval` secure link (no cookies). */
export const clientApprovalLinkApi = {
  async view(token: string, signal?: AbortSignal): Promise<ClientApprovalLinkView> {
    return publicJson<ClientApprovalLinkView>(`/api/v1/public/links/${enc(token)}/client-approval`, "GET", undefined, signal);
  },
  async decide(token: string, decision: "approve" | "reject", comment: string | null): Promise<{ status: string }> {
    return publicJson(`/api/v1/public/links/${enc(token)}/client-approval/decide`, "POST", { decision, comment });
  },
};

async function publicJson<T>(path: string, method: "GET" | "POST", body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal,
    });
  } catch {
    throw new ApiError(0, "network_error", "Cannot reach the server");
  }
  const text = await res.text();
  const parsed: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) throw toApiError(res.status, parsed);
  return parsed as T;
}
