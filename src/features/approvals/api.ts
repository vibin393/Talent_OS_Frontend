import { api } from "@/lib/api/client";
import { pageParams } from "@/features/admin/query";
import type { ApprovalRequestOut, ChainIn, ChainOut, DecideIn, Page } from "@/lib/api/types";

const enc = encodeURIComponent;

export const approvalsApi = {
  mine: (page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Page<ApprovalRequestOut>>(`/api/v1/approvals/mine?${pageParams(page, pageSize)}`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<ApprovalRequestOut>(`/api/v1/approvals/${enc(id)}`, { signal }),
  decide: (id: string, body: DecideIn) => api.post<ApprovalRequestOut>(`/api/v1/approvals/${enc(id)}/decide`, body),

  chains: (signal?: AbortSignal) => api.get<ChainOut[]>("/api/v1/approval-chains", { signal }),
  createChain: (body: ChainIn) => api.post<ChainOut>("/api/v1/approval-chains", body),
  updateChain: (id: string, body: ChainIn) => api.put<ChainOut>(`/api/v1/approval-chains/${enc(id)}`, body),
  deleteChain: (id: string) => api.delete<void>(`/api/v1/approval-chains/${enc(id)}`),
};

export const approvalKeys = {
  all: ["approvals"] as const,
  mine: ["approvals", "mine"] as const,
  minePage: (page: number, pageSize: number) => ["approvals", "mine", page, pageSize] as const,
  chains: ["approvals", "chains"] as const,
};
