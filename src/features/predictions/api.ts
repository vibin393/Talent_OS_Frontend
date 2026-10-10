import { api } from "@/lib/api/client";
import type {
  AnalyticsSettings,
  AnalyticsSettingsPatch,
  ExplanationOut,
  ModelCardsOut,
  PredictionBatchOut,
  PredictionsOut,
  PredictionSubjectKind,
} from "./types";

const enc = encodeURIComponent;
const P = "/api/v1/predictions";

/** Epic 48: predictions, explanations, model cards and analytics settings. */
export const predictionsApi = {
  forSubject: (kind: PredictionSubjectKind, id: string, signal?: AbortSignal) =>
    api.get<PredictionsOut>(`${P}?subject_kind=${enc(kind)}&subject_id=${enc(id)}`, { signal }),
  batch: (kind: PredictionSubjectKind, ids: readonly string[], signal?: AbortSignal) =>
    api.get<PredictionBatchOut>(`${P}/batch?subject_kind=${enc(kind)}${ids.map((i) => `&ids=${enc(i)}`).join("")}`, { signal }),
  explain: (predictionId: string) => api.post<ExplanationOut>(`${P}/${enc(predictionId)}/explanation`),
  models: (signal?: AbortSignal) => api.get<ModelCardsOut>("/api/v1/analytics/models", { signal }),
  train: (kind: string) => api.post<{ queued: boolean }>(`/api/v1/analytics/models/${enc(kind)}/train`),
  settings: (signal?: AbortSignal) => api.get<AnalyticsSettings>("/api/v1/settings/analytics", { signal }),
  saveSettings: (body: AnalyticsSettingsPatch) => api.put<AnalyticsSettings>("/api/v1/settings/analytics", body),
};
