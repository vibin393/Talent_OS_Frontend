/** FX feed API (Epic 51): `/api/v1/fx-feed/*` and the P2 `/api/v1/fx-rates` list. */
import { api } from "@/lib/api/client";
import type { FxFeedRun, FxFeedSettings, FxFeedSettingsIn, FxRate } from "./types";

const V = "/api/v1";

export const fxFeedKeys = {
  all: ["fx-feed"] as const,
  settings: ["fx-feed", "settings"] as const,
  runs: ["fx-feed", "runs"] as const,
  rates: ["fx-feed", "rates"] as const,
};

export const fxFeedApi = {
  settings: (signal?: AbortSignal) => api.get<FxFeedSettings>(`${V}/fx-feed/settings`, { signal }),
  saveSettings: (body: FxFeedSettingsIn) => api.put<FxFeedSettings>(`${V}/fx-feed/settings`, body),
  fetchNow: () => api.post<FxFeedRun>(`${V}/fx-feed/fetch-now`),
  runs: (signal?: AbortSignal) => api.get<FxFeedRun[]>(`${V}/fx-feed/runs`, { signal }),
  rates: (signal?: AbortSignal) => api.get<FxRate[]>(`${V}/fx-rates`, { signal }),
};
