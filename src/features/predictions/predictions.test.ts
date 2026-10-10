import { describe, expect, it } from "vitest";
import { actionsForTrigger, triggerAllowedActions } from "@/features/workflow/allowed-actions";
import {
  bandBadge,
  batchBySubject,
  canSeePredictions,
  contributionWidth,
  directionText,
  formatDays,
  predictionBadgeView,
  progressText,
  settingsErrors,
  topContributions,
  visibleEntries,
} from "./logic";
import type { AnalyticsSettings, Contribution, PredictionBatchItem, PredictionEntry } from "./types";

function entry(over: Partial<PredictionEntry> = {}): PredictionEntry {
  return {
    kind: "offer_drop",
    kind_label: "Offer drop risk",
    status: "ok",
    label: "Supporting signal",
    prediction_id: "p1",
    model_id: "m1",
    model_version: 3,
    computed_at: "2026-10-01T10:00:00Z",
    score: "0.6200",
    predicted_days: null,
    interval: null,
    band: "high",
    contributions: [],
    explanation_status: "none",
    explanation_text: null,
    progress: null,
    ...over,
  };
}

function contribution(key: string, value: string, direction: "up" | "down" = "up"): Contribution {
  return { key, label: key, value_display: "x", contribution: value, direction, display: value };
}

function batchItem(subject_id: string, kind: string, status = "ok", band: PredictionBatchItem["band"] = "high"): PredictionBatchItem {
  return { subject_id, kind, status, band, score: "0.5", predicted_days: null, interval: null };
}

describe("prediction badge", () => {
  it("maps bands to Fluent badge colours", () => {
    expect(bandBadge("low")).toEqual({ label: "Low", color: "success" });
    expect(bandBadge("medium")).toEqual({ label: "Medium", color: "warning" });
    expect(bandBadge("high")).toEqual({ label: "High", color: "danger" });
    expect(bandBadge(null)).toBeNull();
    expect(bandBadge("weird")).toBeNull();
  });

  it("shows time to fill as days with the 20-80 range", () => {
    expect(formatDays("34.0", { p20: "25.2", p80: "48.4" })).toBe("≈ 34 days (25–48)");
    expect(formatDays("1", null)).toBe("≈ 1 day");
    expect(formatDays(null, null)).toBeNull();
    const view = predictionBadgeView({ kind: "time_to_fill", status: "ok", band: null, predicted_days: "34.0", interval: { p20: "25", p80: "48" } });
    expect(view).toEqual({ text: "≈ 34 days (25–48)", color: "informative" });
  });

  it("renders nothing for a prediction that is not ok", () => {
    expect(predictionBadgeView({ kind: "offer_drop", status: "insufficient_data", band: null, predicted_days: null, interval: null })).toBeNull();
    expect(predictionBadgeView({ kind: "offer_drop", status: "ok", band: "high", predicted_days: null, interval: null })).toEqual({
      text: "High",
      color: "danger",
    });
  });
});

describe("prediction panel gating", () => {
  const entries = [entry(), entry({ kind: "attrition", kind_label: "Attrition risk" })];

  it("hides everything without prediction:read", () => {
    expect(canSeePredictions({})).toBe(false);
    expect(canSeePredictions(undefined)).toBe(false);
    expect(visibleEntries(entries, { "prediction:read_attrition": "tenant" })).toEqual([]);
  });

  it("drops attrition without prediction:read_attrition", () => {
    const shown = visibleEntries(entries, { "prediction:read": "tenant" });
    expect(shown.map((e) => e.kind)).toEqual(["offer_drop"]);
  });

  it("shows attrition only when present and permitted", () => {
    const both = { "prediction:read": "tenant", "prediction:read_attrition": "tenant" };
    expect(visibleEntries(entries, both).map((e) => e.kind)).toEqual(["offer_drop", "attrition"]);
    expect(visibleEntries([entry()], both).map((e) => e.kind)).toEqual(["offer_drop"]);
  });

  it("drops attrition from list batches without the permission", () => {
    const items = [batchItem("a", "attrition"), batchItem("a", "offer_drop", "ok", "low"), batchItem("b", "attrition"), batchItem("c", "offer_drop", "insufficient_data", null)];
    const map = batchBySubject(items, ["offer_drop", "attrition"], { "prediction:read": "tenant" });
    expect(map.get("a")?.kind).toBe("offer_drop");
    expect(map.has("b")).toBe(false);
    expect(map.has("c")).toBe(false);
    const all = batchBySubject(items, ["offer_drop", "attrition"], { "prediction:read": "tenant", "prediction:read_attrition": "tenant" });
    expect(all.get("b")?.kind).toBe("attrition");
  });
});

describe("insufficient data", () => {
  it("shows samples progress", () => {
    expect(progressText({ n: 150, required: 200, n_minority: null, required_minority: null })).toBe("Not enough data yet (150 of 200)");
  });

  it("shows minority-class progress", () => {
    expect(progressText({ n: 250, required: 200, n_minority: 20, required_minority: 30 })).toBe(
      "Not enough data yet (20 of 30 in the minority class)",
    );
    expect(progressText({ n: 150, required: 200, n_minority: 20, required_minority: 30 })).toBe(
      "Not enough data yet (150 of 200; 20 of 30 in the minority class)",
    );
  });
});

describe("contributions", () => {
  const list = [
    contribution("a", "0.1"),
    contribution("b", "-0.9", "down"),
    contribution("c", "0.5"),
    contribution("d", "0.2"),
    contribution("e", "0.05"),
    contribution("f", "0.3"),
  ];

  it("shows the top 5 by magnitude, or all", () => {
    expect(topContributions(list, false).map((c) => c.key)).toEqual(["b", "c", "f", "d", "a"]);
    expect(topContributions(list, true)).toHaveLength(6);
  });

  it("scales bars and labels direction in text", () => {
    expect(contributionWidth(list[1], list)).toBe(100);
    expect(contributionWidth(list[2], list)).toBe(56);
    expect(directionText("offer_drop", "up")).toBe("raises risk");
    expect(directionText("attrition", "down")).toBe("lowers risk");
    expect(directionText("time_to_fill", "up")).toBe("adds time");
  });
});

describe("analytics settings", () => {
  const base: AnalyticsSettings = {
    enabled_kinds: { time_to_fill: true, offer_drop: true, attrition: false },
    min_samples: 200,
    min_minority: 30,
    band_thresholds: { offer_drop: { medium: "0.3", high: "0.6" }, attrition: { medium: "0.3", high: "0.6" } },
    history_months: 24,
    platform_min_samples: 200,
    platform_min_minority: 30,
  };

  it("accepts the platform minimums and rejects lower values or inverted bands", () => {
    expect(settingsErrors(base)).toEqual([]);
    expect(settingsErrors({ ...base, min_samples: 100 })).toHaveLength(1);
    expect(settingsErrors({ ...base, min_minority: 10 })).toHaveLength(1);
    expect(settingsErrors({ ...base, band_thresholds: { ...base.band_thresholds, attrition: { medium: "0.7", high: "0.6" } } })).toHaveLength(1);
  });
});

describe("workflow action palette", () => {
  const types = [{ type: "notify" }, { type: "create_task" }, { type: "move_stage" }, { type: "assign" }];

  it("shows only allowed_actions when the trigger restricts them", () => {
    const trigger = { key: "analytics.prediction_band_changed", allowed_actions: ["notify", "create_task"] };
    expect(actionsForTrigger(types, trigger).map((t) => t.type)).toEqual(["notify", "create_task"]);
  });

  it("shows every action when allowed_actions is null or absent", () => {
    expect(actionsForTrigger(types, { key: "demand.created", allowed_actions: null })).toHaveLength(4);
    expect(actionsForTrigger(types, { key: "demand.created" })).toHaveLength(4);
    expect(actionsForTrigger(types, undefined)).toHaveLength(4);
    expect(triggerAllowedActions({ allowed_actions: null })).toBeNull();
  });
});
