import { api } from "@/lib/api/client";
import type {
  ApplyIn,
  ApplyOut,
  CopyDraftOut,
  CopyRequestDetailOut,
  CopyRequestIn,
  CopyRequestOut,
  CopyStatusOut,
  DraftEditIn,
} from "./types";

const enc = encodeURIComponent;
const B = "/api/v1/campaign-copy";

function idempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

/** Epic 78: AI campaign copy (`/api/v1/campaign-copy/*`). */
export const copyApi = {
  request: (body: CopyRequestIn) => api.post<CopyRequestOut>(`${B}/requests`, body, { headers: { "Idempotency-Key": idempotencyKey() } }),
  get: (id: string, signal?: AbortSignal) => api.get<CopyRequestDetailOut>(`${B}/requests/${enc(id)}`, { signal }),
  list: (campaignId: string, signal?: AbortSignal) => api.get<CopyRequestOut[]>(`${B}/requests?campaign_id=${enc(campaignId)}`, { signal }),
  cancel: (id: string) => api.post<CopyRequestOut>(`${B}/requests/${enc(id)}/cancel`),
  segmentOpened: (id: string, segmentKey: string) => api.post<void>(`${B}/requests/${enc(id)}/segments/${enc(segmentKey)}/opened`),
  edit: (draftId: string, body: DraftEditIn) => api.patch<CopyDraftOut>(`${B}/drafts/${enc(draftId)}`, body),
  acknowledge: (draftId: string) => api.post<CopyDraftOut>(`${B}/drafts/${enc(draftId)}/acknowledge-warnings`),
  approve: (draftId: string, note?: string) => api.post<CopyDraftOut>(`${B}/drafts/${enc(draftId)}/approve`, { note: note ?? null }),
  discard: (draftId: string) => api.post<CopyDraftOut>(`${B}/drafts/${enc(draftId)}/discard`),
  apply: (body: ApplyIn) => api.post<ApplyOut>(`${B}/apply`, body),
  campaignStatus: (campaignId: string, signal?: AbortSignal) => api.get<CopyStatusOut>(`${B}/campaigns/${enc(campaignId)}/status`, { signal }),
};

export const copyKeys = {
  all: ["campaign-copy"] as const,
  request: (id: string) => ["campaign-copy", "request", id] as const,
  list: (campaignId: string) => ["campaign-copy", "list", campaignId] as const,
  status: (campaignId: string) => ["campaign-copy", "status", campaignId] as const,
};
