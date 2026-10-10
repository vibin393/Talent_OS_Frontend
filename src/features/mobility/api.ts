import { api } from "@/lib/api/client";
import { portalRequest } from "@/lib/api/portal-client";
import { openingQuery } from "./logic";
import type {
  ApplyIn,
  InternalApplicationOut,
  MobilitySettingsOut,
  MobilitySettingsPatch,
  MyApplicationOut,
  OpeningDetailOut,
  OpeningFilters,
  OpeningPage,
  OpeningRulesIn,
  OpeningRulesOut,
  ProfileImportOut,
  ProfileIn,
  ProfileOut,
  ProfilePreviewOut,
  SubjectKind,
  TransferConfirmIn,
  TransferContextOut,
} from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";
const M = `${V}/mobility`;
const W = `${V}/portal/work/opportunities`;

/** The Employee self-service calls; implemented for internal Users and for the Worker portal. */
export type EmployeeMobilityApi = {
  scope: "me" | "work";
  openings: (filters: OpeningFilters, signal?: AbortSignal) => Promise<OpeningPage>;
  opening: (demandId: string, signal?: AbortSignal) => Promise<OpeningDetailOut>;
  apply: (demandId: string, body: ApplyIn) => Promise<MyApplicationOut>;
  applications: (signal?: AbortSignal) => Promise<MyApplicationOut[]>;
  withdraw: (id: string) => Promise<MyApplicationOut>;
  /** Internal Users only: the Candidate profile the application will use. */
  profile?: (signal?: AbortSignal) => Promise<ProfilePreviewOut>;
};

export const meMobilityApi: EmployeeMobilityApi = {
  scope: "me",
  openings: (filters, signal) => api.get<OpeningPage>(`${M}/openings${openingQuery(filters)}`, { signal }),
  opening: (demandId, signal) => api.get<OpeningDetailOut>(`${M}/openings/${enc(demandId)}`, { signal }),
  apply: (demandId, body) => api.post<MyApplicationOut>(`${M}/openings/${enc(demandId)}/apply`, body),
  applications: (signal) => api.get<MyApplicationOut[]>(`${M}/my-applications`, { signal }),
  withdraw: (id) => api.post<MyApplicationOut>(`${M}/applications/${enc(id)}/withdraw`),
  profile: (signal) => api.get<ProfilePreviewOut>(`${M}/me/profile`, { signal }),
};

export const workMobilityApi: EmployeeMobilityApi = {
  scope: "work",
  openings: (filters, signal) => portalRequest<OpeningPage>(`${W}${openingQuery(filters)}`, { signal }),
  opening: (demandId, signal) => portalRequest<OpeningDetailOut>(`${W}/${enc(demandId)}`, { signal }),
  apply: (demandId, body) => portalRequest<MyApplicationOut>(`${W}/${enc(demandId)}/apply`, { method: "POST", body }),
  applications: (signal) => portalRequest<MyApplicationOut[]>(`${W}/applications`, { signal }),
  withdraw: (id) => portalRequest<MyApplicationOut>(`${W}/applications/${enc(id)}/withdraw`, { method: "POST" }),
};

export const mobilityApi = {
  settings: (signal?: AbortSignal) => api.get<MobilitySettingsOut>(`${M}/settings`, { signal }),
  patchSettings: (body: MobilitySettingsPatch) => api.patch<MobilitySettingsOut>(`${M}/settings`, body),

  applications: (demandId: string, signal?: AbortSignal) =>
    api.get<InternalApplicationOut[]>(`${M}/applications?demand_id=${enc(demandId)}`, { signal }),
  byApplication: (applicationId: string, signal?: AbortSignal) =>
    api.get<InternalApplicationOut>(`${M}/applications/by-application/${enc(applicationId)}`, { signal }),
  transferContext: (id: string, signal?: AbortSignal) =>
    api.get<TransferContextOut>(`${M}/applications/${enc(id)}/transfer-context`, { signal }),
  confirmTransfer: (id: string, body: TransferConfirmIn) =>
    api.post<InternalApplicationOut>(`${M}/applications/${enc(id)}/confirm-transfer`, body),

  rules: (demandId: string, signal?: AbortSignal) => api.get<OpeningRulesOut>(`${M}/demands/${enc(demandId)}/rules`, { signal }),
  putRules: (demandId: string, body: OpeningRulesIn) => api.put<OpeningRulesOut>(`${M}/demands/${enc(demandId)}/rules`, body),

  profiles: (kind: SubjectKind, signal?: AbortSignal) => api.get<ProfileOut[]>(`${M}/profiles?subject_kind=${enc(kind)}`, { signal }),
  putProfile: (body: ProfileIn) => api.put<ProfileOut>(`${M}/profiles`, body),
  importProfiles: (file: File, validateOnly: boolean) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<ProfileImportOut>(`${M}/profiles/import?validate_only=${validateOnly}`, form);
  },
};
