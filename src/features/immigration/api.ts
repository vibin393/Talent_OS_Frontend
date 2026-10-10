import { api } from "@/lib/api/client";
import { ApiError, toApiError } from "@/lib/api/errors";
import { portalRequest } from "@/lib/api/portal-client";
import { type CaseFilters, caseQuery } from "./logic";
import type {
  AdoptIn,
  AtRiskOut,
  CaseCreate,
  CaseEventOut,
  CaseOut,
  CasePatch,
  CaseSummaryOut,
  CounselIn,
  CounselOut,
  CounselPatch,
  DashboardOut,
  DependantIn,
  DependantOut,
  DependantPatch,
  OutcomeIn,
  PermitIn,
  PermitOut,
  PortalCaseDetailOut,
  PortalCasesOut,
  PortalRequestOut,
  PublicUploadOut,
  PublicUploadViewOut,
  RequestOut,
  SendIn,
  SendOut,
  UnmaskOut,
  VerifyOut,
  VisaTemplateOut,
  VisaTypeCreate,
  VisaTypeDefinition,
  VisaTypeDetailOut,
  VisaTypeOut,
  VisaTypePatch,
} from "./types";

const enc = encodeURIComponent;
const I = "/api/v1/immigration";
const W = "/api/v1/portal/work/immigration";

function fileForm(file: File, extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  form.append("file", file);
  return form;
}

export const immigrationApi = {
  // visa templates / types
  templates: (signal?: AbortSignal) => api.get<VisaTemplateOut[]>(`${I}/visa-templates`, { signal }),
  adopt: (key: string, body: AdoptIn = {}) => api.post<VisaTypeDetailOut>(`${I}/visa-templates/${enc(key)}/adopt`, body),
  visaTypes: (includeArchived = false, signal?: AbortSignal) =>
    api.get<VisaTypeOut[]>(`${I}/visa-types${includeArchived ? "?include_archived=true" : ""}`, { signal }),
  createVisaType: (body: VisaTypeCreate) => api.post<VisaTypeDetailOut>(`${I}/visa-types`, body),
  visaType: (id: string, signal?: AbortSignal) => api.get<VisaTypeDetailOut>(`${I}/visa-types/${enc(id)}`, { signal }),
  saveDefinition: (id: string, definition: VisaTypeDefinition) =>
    api.put<VisaTypeDetailOut>(`${I}/visa-types/${enc(id)}/definition`, { definition }),
  patchVisaType: (id: string, body: VisaTypePatch) => api.patch<VisaTypeDetailOut>(`${I}/visa-types/${enc(id)}`, body),
  archiveVisaType: (id: string) => api.post<VisaTypeDetailOut>(`${I}/visa-types/${enc(id)}/archive`),

  // counsel
  counsel: (includeArchived = false, signal?: AbortSignal) =>
    api.get<CounselOut[]>(`${I}/counsel${includeArchived ? "?include_archived=true" : ""}`, { signal }),
  createCounsel: (body: CounselIn) => api.post<CounselOut>(`${I}/counsel`, body),
  patchCounsel: (id: string, body: CounselPatch) => api.patch<CounselOut>(`${I}/counsel/${enc(id)}`, body),

  // cases
  cases: (filters: CaseFilters, signal?: AbortSignal) => api.get<CaseSummaryOut[]>(`${I}/cases${caseQuery(filters)}`, { signal }),
  createCase: (body: CaseCreate) => api.post<CaseOut>(`${I}/cases`, body),
  case: (id: string, signal?: AbortSignal) => api.get<CaseOut>(`${I}/cases/${enc(id)}`, { signal }),
  patchCase: (id: string, body: CasePatch) => api.patch<CaseOut>(`${I}/cases/${enc(id)}`, body),
  moveStage: (id: string, stage_key: string, reason?: string | null) =>
    api.post<CaseOut>(`${I}/cases/${enc(id)}/stage`, { stage_key, ...(reason ? { reason } : {}) }),
  setKeyDate: (id: string, key: string, date: string | null) => api.post<CaseOut>(`${I}/cases/${enc(id)}/key-dates`, { key, date }),
  setReceipt: (id: string, number: string) => api.post<CaseOut>(`${I}/cases/${enc(id)}/receipt`, { number }),
  unmaskReceipt: (id: string) => api.post<UnmaskOut>(`${I}/cases/${enc(id)}/receipt/unmask`),
  outcome: (id: string, body: OutcomeIn) => api.post<CaseOut>(`${I}/cases/${enc(id)}/outcome`, body),
  withdraw: (id: string, reason: string) => api.post<CaseOut>(`${I}/cases/${enc(id)}/withdraw`, { reason }),
  timeline: (id: string, signal?: AbortSignal) => api.get<CaseEventOut[]>(`${I}/cases/${enc(id)}/timeline`, { signal }),

  // dependants
  dependants: (id: string, signal?: AbortSignal) => api.get<DependantOut[]>(`${I}/cases/${enc(id)}/dependants`, { signal }),
  addDependant: (id: string, body: DependantIn) => api.post<DependantOut>(`${I}/cases/${enc(id)}/dependants`, body),
  patchDependant: (id: string, depId: string, body: DependantPatch) =>
    api.patch<DependantOut>(`${I}/cases/${enc(id)}/dependants/${enc(depId)}`, body),
  deleteDependant: (id: string, depId: string) => api.delete<void>(`${I}/cases/${enc(id)}/dependants/${enc(depId)}`),
  unmaskPassport: (id: string, depId: string) =>
    api.post<UnmaskOut>(`${I}/cases/${enc(id)}/dependants/${enc(depId)}/passport/unmask`),

  // checklist requests
  requests: (id: string, signal?: AbortSignal) => api.get<RequestOut[]>(`${I}/cases/${enc(id)}/requests`, { signal }),
  generateChecklist: (id: string) => api.post<RequestOut[]>(`${I}/cases/${enc(id)}/checklist/generate`),
  sendRequests: (id: string, body: SendIn) => api.post<SendOut>(`${I}/cases/${enc(id)}/requests/send`, body),
  uploadRequest: (requestId: string, file: File) => api.post<RequestOut>(`${I}/requests/${enc(requestId)}/upload`, fileForm(file)),
  verifyRequest: (requestId: string) => api.post<VerifyOut>(`${I}/requests/${enc(requestId)}/verify`),
  rejectRequest: (requestId: string, reason: string) => api.post<RequestOut>(`${I}/requests/${enc(requestId)}/reject`, { reason }),
  waiveRequest: (requestId: string, reason: string) => api.post<RequestOut>(`${I}/requests/${enc(requestId)}/waive`, { reason }),

  // permits
  permits: (id: string, signal?: AbortSignal) => api.get<PermitOut[]>(`${I}/cases/${enc(id)}/permits`, { signal }),
  addPermit: (id: string, body: PermitIn) => api.post<PermitOut>(`${I}/cases/${enc(id)}/permits`, body),
  unmaskPermit: (permitId: string) => api.post<UnmaskOut>(`${I}/permits/${enc(permitId)}/unmask`),

  // dashboard
  dashboard: (signal?: AbortSignal) => api.get<DashboardOut>(`${I}/dashboard`, { signal }),
  atRisk: (signal?: AbortSignal) => api.get<AtRiskOut[]>(`${I}/dashboard/at-risk`, { signal }),
};

// ---------------------------------------------------------------- worker portal
export const workImmigrationApi = {
  cases: (signal?: AbortSignal) => portalRequest<PortalCasesOut>(W, { signal }),
  case: (id: string, signal?: AbortSignal) => portalRequest<PortalCaseDetailOut>(`${W}/${enc(id)}`, { signal }),
  consent: () => portalRequest<{ status: string }>(`${W}/consent`, { method: "POST" }),
  upload: (requestId: string, file: File) =>
    portalRequest<PortalRequestOut>(`${W}/requests/${enc(requestId)}/upload`, { method: "POST", body: fileForm(file) }),
};

// ---------------------------------------------------------------- public counsel / no-portal candidate page
const PUB = "/api/v1/public/links";

export const publicImmigrationApi = {
  view: async (token: string, signal?: AbortSignal): Promise<PublicUploadViewOut> => {
    const res = await fetch(`${PUB}/${enc(token)}/immigration-upload`, {
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal,
    });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) throw toApiError(res.status, body);
    return body as PublicUploadViewOut;
  },
  upload: async (token: string, itemId: string, file: File): Promise<PublicUploadOut> => {
    let res: Response;
    try {
      res = await fetch(`${PUB}/${enc(token)}/immigration-upload`, {
        method: "POST",
        body: fileForm(file, { item_id: itemId, consent: "true" }),
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
      });
    } catch {
      throw new ApiError(0, "network_error", "Cannot reach the server");
    }
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) throw toApiError(res.status, body);
    return body as PublicUploadOut;
  },
};
