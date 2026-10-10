import { api } from "@/lib/api/client";
import { portalRequest } from "@/lib/api/portal-client";
import type {
  BenchEntryCreate,
  BenchEntryOut,
  BenchEntryPage,
  BenchEntryUpdate,
  BenchMatchesOut,
  BenchSummaryOut,
  OptInIn,
  ReleaseReason,
  ReviewDecision,
  RollOffRow,
  WorkerBenchState,
} from "./types";

const B = "/api/v1/bench";
const W = "/api/v1/portal/work/bench";
const enc = encodeURIComponent;

export type BenchFilters = {
  status?: string[];
  skill_id?: string[];
  location?: string;
  available_before?: string;
  q?: string;
  page?: number;
  page_size?: number;
};

export function benchQuery(filters: BenchFilters): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => q.append(k, String(x)));
    else q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const benchApi = {
  list: (filters: BenchFilters, signal?: AbortSignal) => api.get<BenchEntryPage>(`${B}/entries${benchQuery(filters)}`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<BenchEntryOut>(`${B}/entries/${enc(id)}`, { signal }),
  create: (body: BenchEntryCreate) => api.post<BenchEntryOut>(`${B}/entries`, body),
  update: (id: string, body: BenchEntryUpdate) => api.patch<BenchEntryOut>(`${B}/entries/${enc(id)}`, body),
  overrideCost: (id: string, costPerDay: string, currency: string) =>
    api.post<BenchEntryOut>(`${B}/entries/${enc(id)}/cost`, { cost_per_day: costPerDay, currency }),
  release: (id: string, reason: ReleaseReason, note: string | null) =>
    api.post<BenchEntryOut>(`${B}/entries/${enc(id)}/release`, { reason, note }),
  matches: (demandId: string, signal?: AbortSignal) => api.get<BenchMatchesOut>(`${B}/demands/${enc(demandId)}/matches`, { signal }),
  review: (demandId: string, candidateId: string, decision: ReviewDecision, reason: string | null) =>
    api.post(`${B}/demands/${enc(demandId)}/reviews`, { candidate_id: candidateId, decision, reason }),
  completeReview: (demandId: string) => api.post(`${B}/demands/${enc(demandId)}/reviews/complete`),
  summary: (months = 6, signal?: AbortSignal) => api.get<BenchSummaryOut>(`${B}/summary?months=${months}`, { signal }),
  rollOffs: (within: 30 | 60, signal?: AbortSignal) => api.get<RollOffRow[]>(`${B}/roll-offs?within=${within}`, { signal }),
};

export const workBenchApi = {
  state: (signal?: AbortSignal) => portalRequest<WorkerBenchState>(W, { signal }),
  optIn: (body: OptInIn) => portalRequest<WorkerBenchState>(`${W}/opt-in`, { method: "POST", body }),
  optOut: () => portalRequest<WorkerBenchState>(`${W}/opt-out`, { method: "POST" }),
};

export const benchKeys = {
  all: ["bench-entries"] as const,
  list: (filters: BenchFilters) => ["bench-entries", "list", filters] as const,
  detail: (id: string) => ["bench-entries", "detail", id] as const,
  matches: (demandId: string) => [`bench-matches:${demandId}`] as const,
  summary: (months: number) => ["bench-summary", months] as const,
  rollOffs: (within: number) => ["bench-roll-offs", within] as const,
  worker: ["portal", "work", "bench"] as const,
};
