/**
 * Epic 48 (predictive analytics) API types. Hand-written mirrors of the backend schemas until
 * `npm run gen:api` runs against a backend with Epic 48. Decimals arrive as strings.
 */

export type PredictionSubjectKind = "demand" | "offer" | "placement";
export type PredictionKind = "time_to_fill" | "offer_drop" | "attrition";
export type PredictionStatus = "ok" | "insufficient_data" | "disabled" | "no_model";
export type PredictionBand = "low" | "medium" | "high";

export type PredictionInterval = { p20: string; p80: string };

export type PredictionProgress = {
  n: number;
  required: number;
  n_minority: number | null;
  required_minority: number | null;
};

export type Contribution = {
  key: string;
  label: string;
  value_display: string;
  /** log-odds (classification) or log-days (time to fill). */
  contribution: string;
  /** "up" raises the risk / adds days. */
  direction: "up" | "down";
  /** e.g. "+9 days" or "+0.42". */
  display: string;
};

export type PredictionEntry = {
  kind: PredictionKind;
  kind_label: string;
  status: PredictionStatus;
  label: string;
  prediction_id: string | null;
  model_id: string | null;
  model_version: number | null;
  computed_at: string | null;
  score: string | null;
  predicted_days: string | null;
  interval: PredictionInterval | null;
  band: PredictionBand | null;
  contributions: Contribution[];
  explanation_status: "none" | "ok" | "unavailable";
  explanation_text: string | null;
  progress: PredictionProgress | null;
};

export type PredictionsOut = {
  subject_kind: string;
  subject_id: string;
  predictions: PredictionEntry[];
};

export type PredictionBatchItem = {
  subject_id: string;
  kind: string;
  status: string;
  band: PredictionBand | null;
  score: string | null;
  predicted_days: string | null;
  interval: PredictionInterval | null;
};

export type PredictionBatchOut = { items: PredictionBatchItem[] };

export type ExplanationOut = { status: "ok" | "unavailable"; text: string | null; disclaimer: string };

export type ModelStatus = "active" | "insufficient_data" | "failed" | "disabled" | "no_model" | "training";

export type ModelDetail = {
  id: string;
  version: number;
  trained_at: string | null;
  n_samples: number;
  n_minority: number | null;
  metrics: Record<string, string>;
  baseline: Record<string, string>;
  calibration: { bin: number; predicted: string; observed: string; n: number }[];
  features: { key: string; label: string; sign: "+" | "-"; rank: number }[];
};

export type ModelHistoryRow = {
  id: string;
  version: number;
  status: string;
  trained_at: string | null;
  n_samples: number;
  failure_code: string | null;
};

export type ModelCard = {
  kind: string;
  kind_label: string;
  enabled: boolean;
  status: ModelStatus;
  /** True for `prediction:read` holders without `model:manage` (no metrics detail). */
  reduced: boolean;
  active: ModelDetail | null;
  latest: { id: string; version: number; status: string; trained_at: string | null; failure_code: string | null } | null;
  progress: PredictionProgress | null;
  excluded_features: string[];
  history: ModelHistoryRow[];
};

export type ModelCardsOut = { cards: ModelCard[] };

export type BandThresholds = { medium: string; high: string };

export type AnalyticsSettings = {
  enabled_kinds: { time_to_fill: boolean; offer_drop: boolean; attrition: boolean };
  min_samples: number;
  min_minority: number;
  band_thresholds: { offer_drop: BandThresholds; attrition: BandThresholds };
  history_months: number;
  platform_min_samples: number;
  platform_min_minority: number;
};

export type AnalyticsSettingsPatch = Partial<
  Pick<AnalyticsSettings, "enabled_kinds" | "min_samples" | "min_minority" | "band_thresholds" | "history_months">
>;
