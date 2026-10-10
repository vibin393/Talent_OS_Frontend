import { api } from "@/lib/api/client";
import type {
  BankAccountIn,
  BankAccountOut,
  DropReason,
  GateOverrideOut,
  MarginOut,
  MarginPreviewIn,
  PlacementCreateBody,
  PlacementOut,
  PlacementPage,
  PreJoiningRow,
  RateSegmentIn,
  RateSegmentOut,
  StartGateOut,
  StatusHistoryOut,
  TouchpointOut,
  UnmaskOut,
  WorkerOut,
} from "./types";

const enc = encodeURIComponent;
const P = "/api/v1/placements";
const W = "/api/v1/workers";

export type PlacementFilters = {
  view?: string;
  client_id?: string;
  legal_entity_id?: string;
  status?: string[];
  worker_type?: string;
  vendor_id?: string;
  ending_within_days?: number;
  compliance?: string;
  q?: string;
  page?: number;
  page_size?: number;
};

export function placementQuery(filters: PlacementFilters): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => q.append(k, String(x)));
    else q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const placementsApi = {
  list: (filters: PlacementFilters, signal?: AbortSignal) => api.get<PlacementPage>(`${P}${placementQuery(filters)}`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<PlacementOut>(`${P}/${enc(id)}`, { signal }),
  create: (body: PlacementCreateBody) => api.post<PlacementOut>(P, body),
  preJoining: (startsWithin = 30, signal?: AbortSignal) => api.get<PreJoiningRow[]>(`${P}/pre-joining?starts_within=${startsWithin}`, { signal }),
  history: (id: string, signal?: AbortSignal) => api.get<StatusHistoryOut[]>(`${P}/${enc(id)}/history`, { signal }),
  touchpoints: (id: string, signal?: AbortSignal) => api.get<TouchpointOut[]>(`${P}/${enc(id)}/touchpoints`, { signal }),
  segments: (id: string, signal?: AbortSignal) => api.get<RateSegmentOut[]>(`${P}/${enc(id)}/rate-segments`, { signal }),
  addSegment: (id: string, body: RateSegmentIn) => api.post<RateSegmentOut>(`${P}/${enc(id)}/rate-segments`, body),
  marginPreview: (body: MarginPreviewIn) => api.post<MarginOut>(`${P}/margin-preview`, body),
  gates: (id: string, signal?: AbortSignal) => api.get<StartGateOut[]>(`${P}/${enc(id)}/start-gates`, { signal }),
  refreshGates: (id: string) => api.post<StartGateOut[]>(`${P}/${enc(id)}/start-gates/refresh`),
  overrides: (id: string, signal?: AbortSignal) => api.get<GateOverrideOut[]>(`${P}/${enc(id)}/gate-overrides`, { signal }),
  requestOverride: (id: string, gateIds: string[], reason: string) =>
    api.post<GateOverrideOut>(`${P}/${enc(id)}/gate-overrides`, { gate_ids: gateIds, reason }),
  join: (id: string, actualStartDate: string) => api.post<PlacementOut>(`${P}/${enc(id)}/join`, { actual_start_date: actualStartDate }),
  drop: (id: string, reason: DropReason, note: string | null) => api.post<PlacementOut>(`${P}/${enc(id)}/drop`, { reason, note }),
  counterOffer: (id: string, note: string | null) => api.post<PlacementOut>(`${P}/${enc(id)}/counter-offer`, { note }),
  clearDropout: (id: string, note: string | null) => api.post<PlacementOut>(`${P}/${enc(id)}/dropout-risk/clear`, { note }),

  worker: (candidateId: string, signal?: AbortSignal) => api.get<WorkerOut>(`${W}/${enc(candidateId)}`, { signal }),
  unmask: (candidateId: string, field: "pan" | "bank_account", bankAccountId?: string) =>
    api.post<UnmaskOut>(`${W}/${enc(candidateId)}/unmask`, { field, bank_account_id: bankAccountId ?? null }),
  requestBankChange: (candidateId: string, body: BankAccountIn) => api.post<BankAccountOut>(`${W}/${enc(candidateId)}/bank-accounts`, body),
};

export const placementKeys = {
  all: ["placements"] as const,
  list: (filters: PlacementFilters) => ["placements", "list", filters] as const,
  detail: (id: string) => ["placements", "detail", id] as const,
  segments: (id: string) => ["placements", "segments", id] as const,
  gates: (id: string) => ["placements", "gates", id] as const,
  overrides: (id: string) => ["placements", "overrides", id] as const,
  history: (id: string) => ["placements", "history", id] as const,
  touchpoints: (id: string) => ["placements", "touchpoints", id] as const,
  preJoining: (days: number) => ["placements", "pre-joining", days] as const,
  worker: (candidateId: string) => ["workers", candidateId] as const,
};
