import { api } from "@/lib/api/client";
import type {
  DismissIn,
  MatchFunnelResponse,
  MatchingSettingsIn,
  MatchingSettingsOut,
  MatchListOut,
  MatchOut,
  RecomputeOut,
} from "@/lib/api/types";

const enc = encodeURIComponent;

export const MATCH_PAGE_SIZE = 25;

export const matchingApi = {
  list: (demandId: string, includeDismissed: boolean, page: number, signal?: AbortSignal) =>
    api.get<MatchListOut>(
      `/api/v1/demands/${enc(demandId)}/matches?include_dismissed=${includeDismissed}&page=${page}&page_size=${MATCH_PAGE_SIZE}`,
      { signal },
    ),
  funnel: (demandId: string, signal?: AbortSignal) =>
    api.get<MatchFunnelResponse>(`/api/v1/demands/${enc(demandId)}/matches/funnel`, { signal }),
  recompute: (demandId: string) => api.post<RecomputeOut>(`/api/v1/demands/${enc(demandId)}/matches/recompute`),
  dismiss: (matchId: string, body: DismissIn) => api.post<MatchOut>(`/api/v1/matches/${enc(matchId)}/dismiss`, body),
  restore: (matchId: string) => api.post<MatchOut>(`/api/v1/matches/${enc(matchId)}/restore`),
  addToPipeline: (matchId: string) => api.post<MatchOut>(`/api/v1/matches/${enc(matchId)}/add-to-pipeline`),
  settings: (signal?: AbortSignal) => api.get<MatchingSettingsOut>("/api/v1/settings/matching", { signal }),
  putSettings: (body: MatchingSettingsIn) => api.put<MatchingSettingsOut>("/api/v1/settings/matching", body),
};

export const matchingKeys = {
  all: ["matching"] as const,
  demand: (demandId: string) => ["matching", "demand", demandId] as const,
  list: (demandId: string, includeDismissed: boolean, page: number) =>
    ["matching", "demand", demandId, "list", includeDismissed, page] as const,
  settings: ["matching", "settings"] as const,
};
