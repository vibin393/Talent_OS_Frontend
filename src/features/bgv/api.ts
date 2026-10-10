import { api } from "@/lib/api/client";
import { portalRequest } from "@/lib/api/portal-client";
import type {
  AdjudicateIn,
  BgvCheck,
  BgvPackage,
  BgvProvider,
  CaseEvent,
  CaseListItem,
  CaseOut,
  CaseSummary,
  Discrepancy,
  DocumentRequest,
  PackageIn,
  PortalCase,
  PortalConsentView,
  PortalDiscrepancy,
  ProviderIn,
  Questionnaire,
  ResultIn,
  Severity,
} from "./types";

const enc = encodeURIComponent;
const A = "/api/v1";
const W = "/api/v1/portal/work";

export type CaseFilters = { status?: string; client_id?: string; assignee_user_id?: string; overdue?: boolean };

export function caseQuery(filters: CaseFilters): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const bgvApi = {
  cases: (filters: CaseFilters, signal?: AbortSignal) => api.get<CaseListItem[]>(`${A}/bgv-cases${caseQuery(filters)}`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<CaseOut>(`${A}/bgv-cases/${enc(id)}`, { signal }),
  timeline: (id: string, signal?: AbortSignal) => api.get<CaseEvent[]>(`${A}/bgv-cases/${enc(id)}/timeline`, { signal }),
  start: (id: string) => api.post<CaseOut>(`${A}/bgv-cases/${enc(id)}/start`),
  cancel: (id: string, reason: string) => api.post<CaseOut>(`${A}/bgv-cases/${enc(id)}/cancel`, { reason }),
  adjudicate: (id: string, body: AdjudicateIn) => api.post<CaseOut>(`${A}/bgv-cases/${enc(id)}/adjudicate`, body),
  reviewDocument: (id: string, key: string, action: "accept" | "return", note: string | null, redactionConfirmed = false) =>
    api.post<DocumentRequest>(`${A}/bgv-cases/${enc(id)}/documents/${enc(key)}/review`, {
      action,
      note,
      redaction_confirmed: redactionConfirmed,
    }),
  placementCases: (placementId: string, signal?: AbortSignal) => api.get<CaseSummary[]>(`${A}/placements/${enc(placementId)}/bgv`, { signal }),
  candidateCases: (candidateId: string, signal?: AbortSignal) =>
    api.get<CaseSummary[]>(`${A}/candidates/${enc(candidateId)}/bgv-cases`, { signal }),
  /** Ad hoc case (``bgv:manage``): a package for a candidate, optionally tied to one of their placements. */
  createCase: (candidateId: string, body: { package_id: string; placement_id?: string | null }) =>
    api.post<CaseOut>(`${A}/candidates/${enc(candidateId)}/bgv-cases`, body),

  assign: (checkId: string, body: { assignee_kind: "internal" | "provider"; assignee_user_id?: string; provider_id?: string }) =>
    api.patch<BgvCheck>(`${A}/bgv-checks/${enc(checkId)}`, body),
  startCheck: (checkId: string) => api.post<BgvCheck>(`${A}/bgv-checks/${enc(checkId)}/start`),
  record: (checkId: string, body: ResultIn) => api.post<BgvCheck>(`${A}/bgv-checks/${enc(checkId)}/result`, body),
  waive: (checkId: string, reason: string) => api.post<BgvCheck>(`${A}/bgv-checks/${enc(checkId)}/waive`, { reason }),
  uploadEvidence: (checkId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<BgvCheck>(`${A}/bgv-checks/${enc(checkId)}/evidence`, form);
  },
  packetHref: (checkId: string) => `${A}/bgv-checks/${enc(checkId)}/packet`,
  raise: (checkId: string, body: { severity: Severity; description: string; internal_note?: string | null }) =>
    api.post<Discrepancy>(`${A}/bgv-checks/${enc(checkId)}/discrepancies`, body),
  resolve: (discrepancyId: string, note: string) =>
    api.post<Discrepancy>(`${A}/bgv-discrepancies/${enc(discrepancyId)}/resolve`, { resolution_note: note }),

  packages: (includeArchived = false, signal?: AbortSignal) =>
    api.get<BgvPackage[]>(`${A}/bgv/packages${includeArchived ? "?include_archived=true" : ""}`, { signal }),
  createPackage: (body: PackageIn) => api.post<BgvPackage>(`${A}/bgv/packages`, body),
  updatePackage: (id: string, body: Partial<PackageIn>) => api.patch<BgvPackage>(`${A}/bgv/packages/${enc(id)}`, body),
  archivePackage: (id: string) => api.post<BgvPackage>(`${A}/bgv/packages/${enc(id)}/archive`),
  providers: (signal?: AbortSignal) => api.get<BgvProvider[]>(`${A}/bgv/providers`, { signal }),
  createProvider: (body: ProviderIn) => api.post<BgvProvider>(`${A}/bgv/providers`, body),
  updateProvider: (id: string, body: Partial<ProviderIn>) => api.patch<BgvProvider>(`${A}/bgv/providers/${enc(id)}`, body),
  questionnaires: (signal?: AbortSignal) => api.get<Questionnaire[]>(`${A}/bgv/reference-questionnaires`, { signal }),
  createQuestionnaire: (body: Omit<Questionnaire, "id" | "archived_at">) =>
    api.post<Questionnaire>(`${A}/bgv/reference-questionnaires`, body),
};

export const bgvKeys = {
  cases: (filters: CaseFilters) => ["bgv", "cases", filters] as const,
  case: (id: string) => ["bgv", "case", id] as const,
  timeline: (id: string) => ["bgv", "timeline", id] as const,
  packages: ["bgv", "packages"] as const,
  providers: ["bgv", "providers"] as const,
  questionnaires: ["bgv", "questionnaires"] as const,
  placement: (id: string) => ["bgv", "placement", id] as const,
};

// ---------------------------------------------------------------- worker portal
export const workBgvApi = {
  cases: (signal?: AbortSignal) => portalRequest<PortalCase[]>(`${W}/bgv/cases`, { signal }),
  consent: (caseId: string, signal?: AbortSignal) => portalRequest<PortalConsentView>(`${W}/bgv/cases/${enc(caseId)}/consent`, { signal }),
  giveConsent: (caseId: string, noticeId: string) =>
    portalRequest<PortalCase>(`${W}/bgv/cases/${enc(caseId)}/consent`, { method: "POST", body: { agreed: true, notice_id: noticeId } }),
  saveDocument: (caseId: string, key: string, input: { files?: File[]; declaration?: unknown; aadhaarLast4?: string }) => {
    const form = new FormData();
    for (const f of input.files ?? []) form.append("files", f);
    if (input.declaration !== undefined) form.append("declaration", JSON.stringify(input.declaration));
    if (input.aadhaarLast4 !== undefined) form.append("aadhaar_last4", input.aadhaarLast4);
    return portalRequest<PortalCase["documents"][number]>(`${W}/bgv/cases/${enc(caseId)}/documents/${enc(key)}`, {
      method: "POST",
      body: form,
    });
  },
  submit: (caseId: string) => portalRequest<PortalCase>(`${W}/bgv/cases/${enc(caseId)}/submit`, { method: "POST" }),
  discrepancies: (signal?: AbortSignal) => portalRequest<PortalDiscrepancy[]>(`${W}/bgv/discrepancies`, { signal }),
  respond: (id: string, response: string, files: File[]) => {
    const form = new FormData();
    form.append("response", response);
    for (const f of files) form.append("files", f);
    return portalRequest<PortalDiscrepancy>(`${W}/bgv/discrepancies/${enc(id)}/respond`, { method: "POST", body: form });
  },
};

export const workBgvKeys = {
  cases: ["portal", "work", "bgv", "cases"] as const,
  consent: (id: string) => ["portal", "work", "bgv", "consent", id] as const,
  discrepancies: ["portal", "work", "bgv", "discrepancies"] as const,
};
