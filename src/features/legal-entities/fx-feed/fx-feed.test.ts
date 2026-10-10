import { describe, expect, it } from "vitest";
import {
  DEFAULT_FEED_FORM,
  formFromSettings,
  normalizePair,
  PRECEDENCE_OPTIONS,
  rateOrigin,
  serializeFeedForm,
  validateFeedForm,
} from "./logic";
import type { FxFeedSettings } from "./types";

describe("FX feed precedence form", () => {
  it("defaults to manual rate wins", () => {
    expect(DEFAULT_FEED_FORM.precedence).toBe("manual_first");
    expect(PRECEDENCE_OPTIONS.map((o) => [o.value, o.label])).toEqual([
      ["manual_first", "Manual rate wins"],
      ["feed_first", "Feed rate wins"],
    ]);
  });

  it("validates pairs, max stale days 1..7 and fetch hour 0..23", () => {
    expect(validateFeedForm(DEFAULT_FEED_FORM)).toEqual({});
    expect(validateFeedForm({ ...DEFAULT_FEED_FORM, pairs: ["USD-INR"] }).pairs).toMatch(/AAA\/BBB/);
    expect(validateFeedForm({ ...DEFAULT_FEED_FORM, pairs: ["usd/inr"] }).pairs).toBeDefined();
    expect(validateFeedForm({ ...DEFAULT_FEED_FORM, enabled: true, pairs: [] }).pairs).toBeDefined();
    expect(validateFeedForm({ ...DEFAULT_FEED_FORM, enabled: false, pairs: [] }).pairs).toBeUndefined();
    expect(validateFeedForm({ ...DEFAULT_FEED_FORM, max_stale_days: 0 }).max_stale_days).toBeDefined();
    expect(validateFeedForm({ ...DEFAULT_FEED_FORM, max_stale_days: 8 }).max_stale_days).toBeDefined();
    expect(validateFeedForm({ ...DEFAULT_FEED_FORM, max_stale_days: 1 }).max_stale_days).toBeUndefined();
    expect(validateFeedForm({ ...DEFAULT_FEED_FORM, max_stale_days: 7 }).max_stale_days).toBeUndefined();
    expect(validateFeedForm({ ...DEFAULT_FEED_FORM, max_stale_days: 2.5 }).max_stale_days).toBeDefined();
    expect(validateFeedForm({ ...DEFAULT_FEED_FORM, fetch_hour_ist: -1 }).fetch_hour_ist).toBeDefined();
    expect(validateFeedForm({ ...DEFAULT_FEED_FORM, fetch_hour_ist: 24 }).fetch_hour_ist).toBeDefined();
    expect(validateFeedForm({ ...DEFAULT_FEED_FORM, fetch_hour_ist: 0 }).fetch_hour_ist).toBeUndefined();
    expect(validateFeedForm({ ...DEFAULT_FEED_FORM, fetch_hour_ist: 23 }).fetch_hour_ist).toBeUndefined();
  });

  it("serializes only editable fields with normalised, unique, sorted pairs", () => {
    const settings: FxFeedSettings = {
      enabled: true,
      pairs: ["USD/INR"],
      precedence: "feed_first",
      max_stale_days: 3,
      fetch_hour_ist: 10,
      provider_key: "fake",
      consecutive_failures: 2,
      last_run: null,
    };
    const form = { ...formFromSettings(settings), pairs: ["usd/inr", "EUR/INR", "USD/INR"] };
    expect(serializeFeedForm(form)).toEqual({
      enabled: true,
      pairs: ["EUR/INR", "USD/INR"],
      precedence: "feed_first",
      max_stale_days: 3,
      fetch_hour_ist: 10,
    });
  });

  it("normalises typed pairs", () => {
    expect(normalizePair(" usd / inr ")).toBe("USD/INR");
    expect(normalizePair("eurinr")).toBe("EUR/INR");
    expect(normalizePair("USD-INR")).toBe("USD/INR");
    expect(normalizePair("INR/INR")).toBeNull();
    expect(normalizePair("US/INR")).toBeNull();
  });

  it("derives the rate origin", () => {
    expect(rateOrigin({ origin: "feed", source: "manual" })).toBe("feed");
    expect(rateOrigin({ source: "feed:fake" })).toBe("feed");
    expect(rateOrigin({ source: "RBI" })).toBe("manual");
  });
});
