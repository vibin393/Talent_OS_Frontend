import { api } from "@/lib/api/client";
import type {
  GenericSlaTargetIn,
  GenericSlaTargetOut,
  GenericSlaTargetUpdate,
  SlaClockView,
  SlaMilestoneOut,
  SlaSummaryOut,
} from "./types";

const enc = encodeURIComponent;
const S = "/api/v1/sla";

/** Generic (Phase 2) SLA targets, milestones, clocks and summaries (Epic 32, story 19.1). */
export const slaApi = {
  milestones: (signal?: AbortSignal) => api.get<SlaMilestoneOut[]>(`${S}/milestones`, { signal }),
  targets: (signal?: AbortSignal) => api.get<GenericSlaTargetOut[]>(`${S}/targets`, { signal }),
  createTarget: (body: GenericSlaTargetIn) => api.post<GenericSlaTargetOut>(`${S}/targets`, body),
  updateTarget: (id: string, body: GenericSlaTargetUpdate) => api.patch<GenericSlaTargetOut>(`${S}/targets/${enc(id)}`, body),
  deleteTarget: (id: string) => api.delete<void>(`${S}/targets/${enc(id)}`),
  clocks: (subjectType: string, subjectId: string, signal?: AbortSignal) =>
    api.get<SlaClockView[]>(`${S}/clocks?subject_type=${enc(subjectType)}&subject_id=${enc(subjectId)}`, { signal }),
  summary: (params: { subject_type: string; milestone?: string; from?: string; to?: string; vendor_id?: string }, signal?: AbortSignal) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
    return api.get<SlaSummaryOut>(`${S}/summary?${p}`, { signal });
  },
};

export const slaKeys = {
  all: ["sla"] as const,
  milestones: ["sla", "milestones"] as const,
  targets: ["sla", "targets"] as const,
  clocks: (subjectType: string, subjectId: string) => ["sla", "clocks", subjectType, subjectId] as const,
};
