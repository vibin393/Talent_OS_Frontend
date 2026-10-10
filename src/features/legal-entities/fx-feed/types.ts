/** Live FX feed (Epic 51 Part A3/B). Hand-written: `gen:api` is not run for this epic. */

export type FxPrecedence = "manual_first" | "feed_first";

export type FxFeedRun = {
  id: string;
  on_date: string;
  status: "ok" | "partial" | "failed";
  provider_key: string;
  fetched: number;
  inserted: number;
  skipped_manual: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

export type FxFeedSettings = {
  enabled: boolean;
  pairs: string[];
  precedence: FxPrecedence;
  max_stale_days: number;
  fetch_hour_ist: number;
  provider_key: string;
  consecutive_failures: number;
  last_run: FxFeedRun | null;
};

export type FxFeedSettingsIn = Pick<FxFeedSettings, "enabled" | "pairs" | "precedence" | "max_stale_days" | "fetch_hour_ist">;

/** `GET /fx-rates` item (P2) with the Epic 51 `origin`. */
export type FxRate = {
  id: string;
  from_currency: string;
  to_currency: string;
  rate_date: string;
  rate: string;
  source: string;
  origin?: "manual" | "feed";
  created_at?: string;
};
