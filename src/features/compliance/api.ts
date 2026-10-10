import { api } from "@/lib/api/client";
import { portalRequest } from "@/lib/api/portal-client";
import type {
  ComplianceDashboard,
  ComplianceSettings,
  Credential,
  CredentialForm,
  CredentialType,
  CredentialTypeIn,
  EvaluationRun,
  PlacementCompliance,
  PortalCredential,
  PortalCredentials,
  Requirement,
  RequirementIn,
} from "./types";

const enc = encodeURIComponent;
const C = "/api/v1/compliance";
const CR = "/api/v1/credentials";
const W = "/api/v1/portal/work/credentials";

/** Multipart body of a credential record / renewal. Only the given file (never anything else) is attached. */
export function credentialForm(input: Omit<CredentialForm, "type_key"> & { type_key?: string }): FormData {
  const form = new FormData();
  if (input.type_key) form.append("type_key", input.type_key);
  for (const key of ["number", "issuer", "issued_on", "expires_on"] as const) {
    const v = input[key];
    if (v) form.append(key, v);
  }
  if (input.file) form.append("file", input.file, input.filename ?? (input.file instanceof File ? input.file.name : "document.jpg"));
  return form;
}

export type CredentialFilters = { expiring_within?: number; status?: string; type?: string; candidate_id?: string };

export function credentialQuery(filters: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "") continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const complianceApi = {
  dashboard: (filters: { client_id?: string; legal_entity_id?: string } = {}, signal?: AbortSignal) =>
    api.get<ComplianceDashboard>(`${C}/dashboard${credentialQuery(filters)}`, { signal }),
  types: (includeArchived = false, signal?: AbortSignal) =>
    api.get<CredentialType[]>(`${C}/credential-types${includeArchived ? "?include_archived=true" : ""}`, { signal }),
  createType: (body: CredentialTypeIn) => api.post<CredentialType>(`${C}/credential-types`, body),
  updateType: (id: string, body: Partial<CredentialTypeIn> & { archived?: boolean }) =>
    api.patch<CredentialType>(`${C}/credential-types/${enc(id)}`, body),
  requirements: (signal?: AbortSignal) => api.get<Requirement[]>(`${C}/requirements`, { signal }),
  createRequirement: (body: RequirementIn) => api.post<Requirement>(`${C}/requirements`, body),
  updateRequirement: (id: string, body: Partial<RequirementIn> & { archived?: boolean }) =>
    api.patch<Requirement>(`${C}/requirements/${enc(id)}`, body),
  evaluationRun: (id: string, signal?: AbortSignal) => api.get<EvaluationRun>(`${C}/evaluation-runs/${enc(id)}`, { signal }),
  settings: (signal?: AbortSignal) => api.get<ComplianceSettings>(`${C}/settings`, { signal }),
  updateSettings: (body: Partial<ComplianceSettings>) => api.put<ComplianceSettings>(`${C}/settings`, body),

  credentials: (filters: CredentialFilters, signal?: AbortSignal) => api.get<Credential[]>(`${CR}${credentialQuery(filters)}`, { signal }),
  candidateCredentials: (candidateId: string, signal?: AbortSignal) =>
    api.get<Credential[]>(`/api/v1/candidates/${enc(candidateId)}/credentials`, { signal }),
  record: (candidateId: string, input: CredentialForm) =>
    api.post<Credential>(`/api/v1/candidates/${enc(candidateId)}/credentials`, credentialForm(input)),
  verify: (id: string, decision: "valid" | "rejected", note?: string) =>
    api.post<Credential>(`${CR}/${enc(id)}/verify`, { decision, note: note || null }),
  redaction: (id: string, decision: "confirmed" | "rejected") => api.post<Credential>(`${CR}/${enc(id)}/redaction`, { decision }),
  unmask: (id: string) => api.post<{ number: string }>(`${CR}/${enc(id)}/unmask`),
  documentHref: (id: string) => `${CR}/${enc(id)}/document`,

  placement: (placementId: string, signal?: AbortSignal) =>
    api.get<PlacementCompliance>(`/api/v1/placements/${enc(placementId)}/compliance`, { signal }),
  waive: (placementId: string, itemId: string, reason: string) =>
    api.post<PlacementCompliance>(`/api/v1/placements/${enc(placementId)}/compliance-items/${enc(itemId)}/waive`, { reason }),
};

export const complianceKeys = {
  dashboard: (filters: object) => ["compliance", "dashboard", filters] as const,
  types: ["compliance", "types"] as const,
  requirements: ["compliance", "requirements"] as const,
  run: (id: string) => ["compliance", "run", id] as const,
  settings: ["compliance", "settings"] as const,
  credentials: (filters: CredentialFilters) => ["compliance", "credentials", filters] as const,
  candidate: (id: string) => ["compliance", "candidate", id] as const,
  placement: (id: string) => ["compliance", "placement", id] as const,
};

// ---------------------------------------------------------------- worker portal
export const workCredentialsApi = {
  list: (signal?: AbortSignal) => portalRequest<PortalCredentials>(W, { signal }),
  record: (input: CredentialForm) => portalRequest<PortalCredential>(W, { method: "POST", body: credentialForm(input) }),
  renew: (id: string, input: Omit<CredentialForm, "type_key">) =>
    portalRequest<PortalCredential>(`${W}/${enc(id)}/renew`, { method: "POST", body: credentialForm(input) }),
  documentHref: (id: string) => `${W}/${enc(id)}/document`,
};

export const workCredentialsKeys = { list: ["work", "credentials"] as const };
