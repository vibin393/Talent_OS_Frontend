/** DSC API (Epic 51): `/api/v1/dsc/policies` and `/api/v1/billing/{kind}/{id}/dsc*`. */
import { api } from "@/lib/api/client";
import { downloadApiFile } from "@/lib/api/download";
import type { DscKind, DscPending, DscPolicy, DscPolicyIn, DscPolicyUpdate, DscStatus, DscUploadResult } from "./types";

const V = "/api/v1";
const enc = encodeURIComponent;
const KIND_PATH: Record<DscKind, string> = { invoice: "invoices", credit_note: "credit-notes" };

export const dscDocPath = (kind: DscKind, id: string) => `${V}/billing/${KIND_PATH[kind]}/${enc(id)}/dsc`;

export const dscKeys = {
  all: ["dsc"] as const,
  policies: ["dsc", "policies"] as const,
  pending: ["dsc", "pending"] as const,
  status: (kind: DscKind, id: string) => ["dsc", "status", kind, id] as const,
};

export const dscApi = {
  policies: (signal?: AbortSignal) => api.get<DscPolicy[]>(`${V}/dsc/policies`, { signal }),
  createPolicy: (body: DscPolicyIn) => api.post<DscPolicy>(`${V}/dsc/policies`, body),
  updatePolicy: (id: string, body: DscPolicyUpdate) => api.patch<DscPolicy>(`${V}/dsc/policies/${enc(id)}`, body),
  deletePolicy: (id: string) => api.delete<void>(`${V}/dsc/policies/${enc(id)}`),
  pending: (signal?: AbortSignal) => api.get<DscPending[]>(`${V}/billing/dsc/pending`, { signal }),
  status: (kind: DscKind, id: string, signal?: AbortSignal) => api.get<DscStatus>(dscDocPath(kind, id), { signal }),
  /** Saves the stored render (the exact bytes to sign externally). */
  downloadRender: (kind: DscKind, id: string, number: string | null) =>
    downloadApiFile(`${dscDocPath(kind, id)}/render`, `${number ?? id}-to-sign.pdf`),
  upload: (kind: DscKind, id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<DscUploadResult>(`${dscDocPath(kind, id)}/upload`, form);
  },
  retry: (kind: DscKind, id: string) => api.post<DscStatus>(`${dscDocPath(kind, id)}/retry`),
};
