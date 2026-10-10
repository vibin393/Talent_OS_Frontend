import { api } from "@/lib/api/client";
import type { FunnelOut } from "@/features/campaigns/types";
import type { EnrolIn, EnrollmentOut, EnrolOut, SequenceCreate, SequenceOut, SequenceUpdate } from "./types";

const enc = encodeURIComponent;
const S = "/api/v1/marketing/sequences";
const E = "/api/v1/marketing/enrollments";

export const sequencesApi = {
  list: (signal?: AbortSignal) => api.get<SequenceOut[]>(S, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<SequenceOut>(`${S}/${enc(id)}`, { signal }),
  create: (body: SequenceCreate) => api.post<SequenceOut>(S, body),
  update: (id: string, body: SequenceUpdate) => api.patch<SequenceOut>(`${S}/${enc(id)}`, body),
  publish: (id: string, note: string | null) => api.post<SequenceOut>(`${S}/${enc(id)}/publish`, { note }),
  pause: (id: string) => api.post<SequenceOut>(`${S}/${enc(id)}/pause`),
  resume: (id: string) => api.post<SequenceOut>(`${S}/${enc(id)}/resume`),
  archive: (id: string) => api.post<SequenceOut>(`${S}/${enc(id)}/archive`),
  enrol: (id: string, body: EnrolIn) => api.post<EnrolOut>(`${S}/${enc(id)}/enrol`, body),
  enrollments: (id: string, signal?: AbortSignal) => api.get<EnrollmentOut[]>(`${S}/${enc(id)}/enrollments`, { signal }),
  analytics: (id: string, signal?: AbortSignal) => api.get<FunnelOut>(`${S}/${enc(id)}/analytics`, { signal }),
  pauseEnrollment: (id: string) => api.post<EnrollmentOut>(`${E}/${enc(id)}/pause`),
  resumeEnrollment: (id: string) => api.post<EnrollmentOut>(`${E}/${enc(id)}/resume`),
  exitEnrollment: (id: string) => api.post<EnrollmentOut>(`${E}/${enc(id)}/exit`),
};

export const sequenceKeys = {
  all: ["marketing", "sequences"] as const,
  list: ["marketing", "sequences", "list"] as const,
  detail: (id: string) => ["marketing", "sequences", "detail", id] as const,
  enrollments: (id: string) => ["marketing", "sequences", "enrollments", id] as const,
  analytics: (id: string) => ["marketing", "sequences", "analytics", id] as const,
};
