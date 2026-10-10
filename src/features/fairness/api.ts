import { api, apiRequest } from "@/lib/api/client";
import { portalRequest } from "@/lib/api/portal-client";
import type {
  AedtIn,
  AedtOut,
  AlternativeRequestOut,
  CategorySetIn,
  FairnessSettingsOut,
  FairnessSettingsPatch,
  Ll144FlagOut,
  PackOut,
  PublicationCreate,
  PublicationOut,
  PublicNoticeOut,
  PublicPublicationOut,
  RunCreate,
  RunOut,
  RunSummaryOut,
  SelfIdAnswers,
  SelfIdFormOut,
  SelfIdIn,
  SelfIdOut,
} from "./types";

import type { SelectionPointOut } from "@/lib/api/governance-types";

const enc = encodeURIComponent;
const F = "/api/v1/fairness";
const PUB = (slug: string) => `/api/v1/public/fairness/${enc(slug)}`;

/** Epic 49 internal endpoints (tenant session). */
export const fairnessApi = {
  settings: (signal?: AbortSignal) => api.get<FairnessSettingsOut>(`${F}/settings`, { signal }),
  saveSettings: (body: FairnessSettingsPatch) => api.patch<FairnessSettingsOut>(`${F}/settings`, body),
  saveCategorySet: (body: CategorySetIn) => api.put<FairnessSettingsOut>(`${F}/category-set`, body),

  runs: (signal?: AbortSignal) => api.get<RunSummaryOut[]>(`${F}/runs`, { signal }),
  /** Epic 65: selection points with availability (agent points need their owner tables). */
  selectionPoints: (signal?: AbortSignal) => api.get<SelectionPointOut[]>(`${F}/selection-points`, { signal }),
  createRun: (body: RunCreate) => api.post<RunOut>(`${F}/runs`, body),
  run: (id: string, signal?: AbortSignal) => api.get<RunOut>(`${F}/runs/${enc(id)}`, { signal }),
  generatePack: (runId: string, aedtId: string) => api.post<PackOut>(`${F}/runs/${enc(runId)}/pack`, { aedt_id: aedtId }),

  aedts: (signal?: AbortSignal) => api.get<AedtOut[]>(`${F}/aedt`, { signal }),
  createAedt: (body: AedtIn) => api.post<AedtOut>(`${F}/aedt`, body),
  updateAedt: (id: string, body: Partial<AedtIn>) => api.patch<AedtOut>(`${F}/aedt/${enc(id)}`, body),

  publications: (signal?: AbortSignal) => api.get<PublicationOut[]>(`${F}/publications`, { signal }),
  publish: (body: PublicationCreate) => api.post<PublicationOut>(`${F}/publications`, body),
  unpublish: (id: string) => api.post<PublicationOut>(`${F}/publications/${enc(id)}/unpublish`),

  ll144: (demandId: string, signal?: AbortSignal) => api.get<Ll144FlagOut>(`${F}/demands/${enc(demandId)}/ll144`, { signal }),
  setLl144: (demandId: string, flagged: boolean) => api.put<Ll144FlagOut>(`${F}/demands/${enc(demandId)}/ll144`, { flagged }),

  alternativeRequest: (applicationId: string, signal?: AbortSignal) =>
    api.get<AlternativeRequestOut | null>(`${F}/applications/${enc(applicationId)}/alternative-request`, { signal }),
};

/** Candidate Portal endpoints (candidate cookie + CSRF). */
export const portalFairnessApi = {
  selfId: (signal?: AbortSignal) => portalRequest<SelfIdOut>("/api/v1/portal/self-id", { signal }),
  saveSelfId: (body: SelfIdIn) => portalRequest<SelfIdOut>("/api/v1/portal/self-id", { method: "PUT", body }),
  deleteSelfId: () => portalRequest<void>("/api/v1/portal/self-id", { method: "DELETE" }),
  alternativeRequests: (signal?: AbortSignal) => portalRequest<AlternativeRequestOut[]>("/api/v1/portal/alternative-requests", { signal }),
  requestAlternative: (applicationId: string, note: string | null) =>
    portalRequest<AlternativeRequestOut>("/api/v1/portal/alternative-requests", { method: "POST", body: { application_id: applicationId, note } }),
};

const pub = { skipAuthHandler: true } as const;

/** Public Career Portal endpoints (no principal; the apply token proves the just-submitted application). */
export const publicFairnessApi = {
  selfIdForm: (slug: string, signal?: AbortSignal) => apiRequest<SelfIdFormOut>(`${PUB(slug)}/self-id-form`, { ...pub, signal }),
  submitSelfId: (slug: string, applyToken: string, noticeId: string, answers: SelfIdAnswers) =>
    apiRequest<{ status: string }>(`${PUB(slug)}/self-id`, {
      ...pub,
      method: "POST",
      body: { apply_token: applyToken, notice_id: noticeId, answers },
      headers: { "X-Apply-Token": applyToken },
    }),
  notice: (slug: string, postingId: string, signal?: AbortSignal) =>
    apiRequest<PublicNoticeOut>(`${PUB(slug)}/notice?posting_id=${enc(postingId)}`, { ...pub, signal }),
  requestAlternative: (slug: string, applyToken: string, note: string | null) =>
    apiRequest<{ status: string }>(`${PUB(slug)}/alternative-request`, {
      ...pub,
      method: "POST",
      body: { apply_token: applyToken, note },
      headers: { "X-Apply-Token": applyToken },
    }),
  summary: (slug: string, signal?: AbortSignal) => apiRequest<PublicPublicationOut[]>(`${PUB(slug)}/summary`, { ...pub, signal }),
};
