import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type {
  ApprovalRequestOut,
  AssignmentsIn,
  AssignmentsOut,
  BiasCheckOut,
  BiasedTermIn,
  BiasedTermOut,
  BusinessCalendarIn,
  BusinessCalendarOut,
  DemandCreate,
  DemandDocumentOut,
  DemandOut,
  DemandSettingsOut,
  DemandUpdate,
  JdKind,
  JdVersionOut,
  Page,
  PostingIn,
  PostingOut,
  ReasonCodesOut,
  SlaTargetIn,
  SlaTargetOut,
  TransitionIn,
} from "@/lib/api/types";
import { type DemandListFilters, demandListQuery } from "./query";

const enc = encodeURIComponent;
const D = "/api/v1/demands";
const S = "/api/v1/settings";

export const demandsApi = {
  list: (filters: DemandListFilters, pageSize: number, signal?: AbortSignal) =>
    api.get<Page<DemandOut>>(`${D}?${demandListQuery(filters, pageSize)}`, { signal }),
  create: (body: DemandCreate) => api.post<DemandOut>(D, body),
  get: (id: string, signal?: AbortSignal) => api.get<DemandOut>(`${D}/${enc(id)}`, { signal }),
  update: (id: string, body: DemandUpdate) => api.patch<DemandOut>(`${D}/${enc(id)}`, body),
  confirmAiFields: (id: string, fields?: string[]) =>
    api.post<DemandOut>(`${D}/${enc(id)}/confirm-ai-fields`, fields ? { fields } : {}),
  archive: (id: string) => api.post<DemandOut>(`${D}/${enc(id)}/archive`),
  submit: (id: string) => api.post<DemandOut>(`${D}/${enc(id)}/submit`),
  transition: (id: string, body: TransitionIn) => api.post<DemandOut>(`${D}/${enc(id)}/transition`, body),
  reasonCodes: (signal?: AbortSignal) => api.get<ReasonCodesOut>(`${D}/reason-codes`, { signal }),
  intake: (form: FormData) => api.post<DemandOut>(`${D}/intake`, form),
  approvals: (id: string, signal?: AbortSignal) =>
    api.get<ApprovalRequestOut[]>(`${D}/${enc(id)}/approvals`, { signal }),
  documents: (id: string, signal?: AbortSignal) =>
    api.get<DemandDocumentOut[]>(`${D}/${enc(id)}/documents`, { signal }),

  jdVersions: (id: string, signal?: AbortSignal) => api.get<JdVersionOut[]>(`${D}/${enc(id)}/jd-versions`, { signal }),
  saveJd: (id: string, kind: JdKind, content: string) =>
    api.post<JdVersionOut>(`${D}/${enc(id)}/jd-versions`, { kind, content }),
  generateJd: (id: string, kind: JdKind) => api.post<JdVersionOut>(`${D}/${enc(id)}/jd-versions/generate`, { kind }),
  restoreJd: (id: string, versionId: string) =>
    api.post<JdVersionOut>(`${D}/${enc(id)}/jd-versions/${enc(versionId)}/restore`),
  biasCheck: (id: string, versionId: string) =>
    api.post<BiasCheckOut>(`${D}/${enc(id)}/jd-versions/${enc(versionId)}/bias-check`),
  /** The demand's posting, or null when it was never published (the API answers a JSON `null`). */
  posting: (id: string, signal?: AbortSignal) =>
    api.get<PostingOut | null>(`${D}/${enc(id)}/posting`, { signal }).catch((e: unknown) => {
      if (isApiError(e) && e.code === "invalid_response") return null;
      throw e;
    }),
  publish: (id: string, body: PostingIn) => api.post<PostingOut>(`${D}/${enc(id)}/posting`, body),
  unpublish: (id: string) => api.delete<PostingOut>(`${D}/${enc(id)}/posting`),

  assignments: (id: string, signal?: AbortSignal) =>
    api.get<AssignmentsOut>(`${D}/${enc(id)}/assignments`, { signal }),
  setAssignments: (id: string, body: AssignmentsIn) => api.put<AssignmentsOut>(`${D}/${enc(id)}/assignments`, body),

  slaTargets: (signal?: AbortSignal) => api.get<SlaTargetOut[]>(`${S}/sla-targets`, { signal }),
  putSlaTargets: (targets: SlaTargetIn[]) => api.put<SlaTargetOut[]>(`${S}/sla-targets`, { targets }),
  calendar: (signal?: AbortSignal) => api.get<BusinessCalendarOut>(`${S}/business-calendar`, { signal }),
  putCalendar: (body: BusinessCalendarIn) => api.put<BusinessCalendarOut>(`${S}/business-calendar`, body),
  settings: (signal?: AbortSignal) => api.get<DemandSettingsOut>(`${S}/demands`, { signal }),
  putSettings: (reqPrefix: string) => api.put<DemandSettingsOut>(`${S}/demands`, { req_prefix: reqPrefix }),
  biasedTerms: (signal?: AbortSignal) => api.get<BiasedTermOut[]>(`${S}/biased-terms`, { signal }),
  upsertBiasedTerm: (body: BiasedTermIn) => api.post<BiasedTermOut>(`${S}/biased-terms`, body),
  deleteBiasedTerm: (id: string) => api.delete<void>(`${S}/biased-terms/${enc(id)}`),
};

export const demandKeys = {
  all: ["demands"] as const,
  lists: ["demands", "list"] as const,
  list: (filters: DemandListFilters, pageSize: number) => ["demands", "list", filters, pageSize] as const,
  /** Everything about one demand (detail, JD, posting, assignments, approvals) shares this prefix. */
  demand: (id: string) => ["demands", "detail", id] as const,
  detail: (id: string) => ["demands", "detail", id, "record"] as const,
  jd: (id: string) => ["demands", "detail", id, "jd"] as const,
  posting: (id: string) => ["demands", "detail", id, "posting"] as const,
  assignments: (id: string) => ["demands", "detail", id, "assignments"] as const,
  approvals: (id: string) => ["demands", "detail", id, "approvals"] as const,
  reasonCodes: ["demands", "reason-codes"] as const,
  slaTargets: ["demands", "settings", "sla-targets"] as const,
  calendar: ["demands", "settings", "calendar"] as const,
  settings: ["demands", "settings", "general"] as const,
  biasedTerms: ["demands", "settings", "biased-terms"] as const,
};
