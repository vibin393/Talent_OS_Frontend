/**
 * Expenses API (Epic 27): internal `/api/v1/expenses/*` (tenant session), Worker `/api/v1/portal/work/expense-*`
 * (candidate session) and Client `/api/v1/client-portal/expenses` (client session).
 */
import { api } from "@/lib/api/client";
import { clientPortalRequest } from "@/lib/api/client-portal-client";
import { portalRequest } from "@/lib/api/portal-client";
import type {
  ClaimablePlacement,
  ClaimDetailOut,
  ClaimFilters,
  ClaimSummaryOut,
  ClientClaimDetail,
  ClientClaimSummary,
  DecideIn,
  ExpenseSettingsOut,
  ExpenseSettingsUpdate,
  LineIn,
  LinePreviewOut,
  PolicyCreateIn,
  PolicyOut,
  PolicyVersionIn,
  ReceiptReadOut,
  ReceiptUploadOut,
  WorkerClaimOut,
  WorkerClaimSummary,
  WorkerExpenseSettings,
} from "./types";

const enc = encodeURIComponent;
const E = "/api/v1/expenses";
const W = "/api/v1/portal/work";
const C = "/api/v1/client-portal/expenses";

function qs(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ---------------------------------------------------------------- internal
export const expensesApi = {
  settings: (signal?: AbortSignal) => api.get<ExpenseSettingsOut>(`${E}/settings`, { signal }),
  updateSettings: (body: ExpenseSettingsUpdate) => api.patch<ExpenseSettingsOut>(`${E}/settings`, body),
  policies: (signal?: AbortSignal) => api.get<PolicyOut[]>(`${E}/policies`, { signal }),
  policy: (id: string, version?: number, signal?: AbortSignal) =>
    api.get<PolicyOut>(`${E}/policies/${enc(id)}${version ? `?version=${version}` : ""}`, { signal }),
  createPolicy: (body: PolicyCreateIn) => api.post<PolicyOut>(`${E}/policies`, body),
  newPolicyVersion: (id: string, body: PolicyVersionIn) => api.post<PolicyOut>(`${E}/policies/${enc(id)}/versions`, body),
  claims: (f: ClaimFilters, signal?: AbortSignal) => api.get<ClaimSummaryOut[]>(`${E}/claims${qs(f)}`, { signal }),
  claim: (id: string, signal?: AbortSignal) => api.get<ClaimDetailOut>(`${E}/claims/${enc(id)}`, { signal }),
  createProxy: (body: { placement_id: string; title?: string | null; proxy_reason: string }) =>
    api.post<ClaimDetailOut>(`${E}/claims`, body),
  addLine: (id: string, body: LineIn) => api.post<ClaimDetailOut>(`${E}/claims/${enc(id)}/lines`, body),
  updateLine: (id: string, lineId: string, body: LineIn) =>
    api.put<ClaimDetailOut>(`${E}/claims/${enc(id)}/lines/${enc(lineId)}`, body),
  deleteLine: (id: string, lineId: string) => api.delete<ClaimDetailOut>(`${E}/claims/${enc(id)}/lines/${enc(lineId)}`),
  previewLine: (id: string, body: LineIn) => api.post<LinePreviewOut>(`${E}/claims/${enc(id)}/lines/preview`, body),
  submit: (id: string, proxyReason: string) => api.post<ClaimDetailOut>(`${E}/claims/${enc(id)}/submit`, { proxy_reason: proxyReason }),
  decide: (id: string, body: DecideIn) => api.post<ClaimDetailOut>(`${E}/claims/${enc(id)}/decide`, body),
  reopen: (id: string, reason: string) => api.post<ClaimDetailOut>(`${E}/claims/${enc(id)}/reopen`, { reason }),
  receiptUrl: (id: string, lineId: string) => `${E}/claims/${enc(id)}/lines/${enc(lineId)}/receipt`,
};

export const expenseKeys = {
  all: ["expenses"] as const,
  settings: ["expenses", "settings"] as const,
  policies: ["expenses", "policies"] as const,
  policy: (id: string, version?: number) => ["expenses", "policies", id, version ?? "latest"] as const,
  claims: ["expenses", "claims"] as const,
  claimList: (f: ClaimFilters) => ["expenses", "claims", f] as const,
  claim: (id: string) => ["expenses", "claim", id] as const,
};

// ---------------------------------------------------------------- Worker portal
export const workerExpensesApi = {
  settings: (signal?: AbortSignal) => portalRequest<WorkerExpenseSettings>(`${W}/expense-settings`, { signal }),
  list: (signal?: AbortSignal) => portalRequest<WorkerClaimSummary[]>(`${W}/expense-claims`, { signal }),
  placements: (signal?: AbortSignal) => portalRequest<ClaimablePlacement[]>(`${W}/expense-claims/placements`, { signal }),
  create: (body: { placement_id: string; title?: string | null }) =>
    portalRequest<WorkerClaimOut>(`${W}/expense-claims`, { method: "POST", body }),
  get: (id: string, signal?: AbortSignal) => portalRequest<WorkerClaimOut>(`${W}/expense-claims/${enc(id)}`, { signal }),
  rename: (id: string, title: string) =>
    portalRequest<WorkerClaimOut>(`${W}/expense-claims/${enc(id)}`, { method: "PATCH", body: { title } }),
  addLine: (id: string, body: LineIn) =>
    portalRequest<WorkerClaimOut>(`${W}/expense-claims/${enc(id)}/lines`, { method: "POST", body }),
  updateLine: (id: string, lineId: string, body: LineIn) =>
    portalRequest<WorkerClaimOut>(`${W}/expense-claims/${enc(id)}/lines/${enc(lineId)}`, { method: "PUT", body }),
  deleteLine: (id: string, lineId: string) =>
    portalRequest<WorkerClaimOut>(`${W}/expense-claims/${enc(id)}/lines/${enc(lineId)}`, { method: "DELETE" }),
  previewLine: (id: string, body: LineIn) =>
    portalRequest<LinePreviewOut>(`${W}/expense-claims/${enc(id)}/lines/preview`, { method: "POST", body }),
  submit: (id: string) => portalRequest<WorkerClaimOut>(`${W}/expense-claims/${enc(id)}/submit`, { method: "POST" }),
  recall: (id: string) => portalRequest<WorkerClaimOut>(`${W}/expense-claims/${enc(id)}/recall`, { method: "POST" }),
  uploadReceipt: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return portalRequest<ReceiptUploadOut>(`${W}/expense-receipts`, { method: "POST", body: form });
  },
  readReceipt: (fileId: string) =>
    portalRequest<ReceiptReadOut>(`${W}/expense-receipts/${enc(fileId)}/read`, { method: "POST" }),
  receiptUrl: (fileId: string) => `${W}/expense-receipts/${enc(fileId)}`,
};

export const workerExpenseKeys = {
  settings: ["portal", "work", "expenses", "settings"] as const,
  list: ["portal", "work", "expenses", "list"] as const,
  placements: ["portal", "work", "expenses", "placements"] as const,
  detail: (id: string) => ["portal", "work", "expenses", "detail", id] as const,
};

// ---------------------------------------------------------------- Client portal
export const clientExpensesApi = {
  list: (status: "pending" | "all", signal?: AbortSignal) =>
    clientPortalRequest<ClientClaimSummary[]>(`${C}?status=${status}`, { signal }),
  get: (id: string, signal?: AbortSignal) => clientPortalRequest<ClientClaimDetail>(`${C}/${enc(id)}`, { signal }),
  decide: (id: string, body: DecideIn) => clientPortalRequest<ClientClaimDetail>(`${C}/${enc(id)}/decide`, { method: "POST", body }),
  receiptUrl: (id: string, lineId: string) => `${C}/${enc(id)}/lines/${enc(lineId)}/receipt`,
};

export const clientExpenseKeys = {
  all: ["client-portal", "expenses"] as const,
  list: (status: "pending" | "all") => ["client-portal", "expenses", status] as const,
  detail: (id: string) => ["client-portal", "expenses", "detail", id] as const,
};
