/** Pure helpers for the FX feed settings form (Epic 51). */
import type { FxFeedSettings, FxFeedSettingsIn, FxPrecedence, FxRate } from "./types";

export const PAIR_OPTIONS = ["USD/INR", "EUR/INR", "GBP/INR", "AED/INR", "SGD/INR", "AUD/INR", "CAD/INR", "JPY/INR"] as const;
export const PAIR_RE = /^[A-Z]{3}\/[A-Z]{3}$/;

export const PRECEDENCE_OPTIONS: { value: FxPrecedence; label: string; hint: string }[] = [
  { value: "manual_first", label: "Manual rate wins", hint: "A manual rate on the same date is used over the feed rate." },
  { value: "feed_first", label: "Feed rate wins", hint: "The feed rate is used even when a manual rate exists for the date." },
];

export const MAX_STALE_MIN = 1;
export const MAX_STALE_MAX = 7;

/** "usd / inr" -> "USD/INR" (null when not a 3-letter/3-letter pair). */
export function normalizePair(raw: string): string | null {
  const v = raw.trim().toUpperCase().replace(/\s+/g, "");
  const m = /^([A-Z]{3})[/-]?([A-Z]{3})$/.exec(v);
  return m && m[1] !== m[2] ? `${m[1]}/${m[2]}` : null;
}

export type FeedForm = FxFeedSettingsIn;

export const DEFAULT_FEED_FORM: FeedForm = {
  enabled: false,
  pairs: ["USD/INR"],
  precedence: "manual_first",
  max_stale_days: 3,
  fetch_hour_ist: 9,
};

export function formFromSettings(s: FxFeedSettings | undefined): FeedForm {
  if (!s) return DEFAULT_FEED_FORM;
  return {
    enabled: s.enabled,
    pairs: [...s.pairs],
    precedence: s.precedence,
    max_stale_days: s.max_stale_days,
    fetch_hour_ist: s.fetch_hour_ist,
  };
}

/** Field errors for the form (empty object = valid). */
export function validateFeedForm(f: FeedForm): Partial<Record<keyof FeedForm, string>> {
  const errors: Partial<Record<keyof FeedForm, string>> = {};
  const bad = f.pairs.filter((p) => !PAIR_RE.test(p));
  if (bad.length) errors.pairs = `Use the format AAA/BBB (invalid: ${bad.join(", ")}).`;
  else if (f.enabled && f.pairs.length === 0) errors.pairs = "Pick at least one currency pair.";
  else if (new Set(f.pairs).size !== f.pairs.length) errors.pairs = "Each pair can be listed once.";
  if (f.precedence !== "manual_first" && f.precedence !== "feed_first") errors.precedence = "Choose which rate wins.";
  if (!Number.isInteger(f.max_stale_days) || f.max_stale_days < MAX_STALE_MIN || f.max_stale_days > MAX_STALE_MAX)
    errors.max_stale_days = `Between ${MAX_STALE_MIN} and ${MAX_STALE_MAX} days.`;
  if (!Number.isInteger(f.fetch_hour_ist) || f.fetch_hour_ist < 0 || f.fetch_hour_ist > 23)
    errors.fetch_hour_ist = "An hour between 0 and 23.";
  return errors;
}

/** PUT body: only the editable fields, pairs normalised, de-duplicated and sorted. */
export function serializeFeedForm(f: FeedForm): FxFeedSettingsIn {
  const pairs = [...new Set(f.pairs.map((p) => normalizePair(p) ?? p.trim().toUpperCase()))].sort((x, y) => (String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0));
  return {
    enabled: f.enabled,
    pairs,
    precedence: f.precedence,
    max_stale_days: f.max_stale_days,
    fetch_hour_ist: f.fetch_hour_ist,
  };
}

/** Origin of a rate: the API's `origin`, else inferred from `source` (`feed:*`). */
export function rateOrigin(r: Pick<FxRate, "origin" | "source">): "manual" | "feed" {
  if (r.origin) return r.origin;
  return r.source?.startsWith("feed") ? "feed" : "manual";
}
