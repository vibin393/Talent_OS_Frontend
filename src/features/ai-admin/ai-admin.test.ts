import { describe, expect, it } from "vitest";
import { aiFeatureLabel, isAiFeatureEnabled } from "./ai-features";
import { aiLogQuery, EMPTY_AI_LOG_FILTERS } from "./ai-log-query";
import { budgetState, markerPosition } from "./budget-state";

describe("AiFeatureGate decision", () => {
  it("shows controls only for enabled features once loaded", () => {
    const map = { matching: false, nl_search: true };
    expect(isAiFeatureEnabled(map, "nl_search")).toBe(true);
    expect(isAiFeatureEnabled(map, "matching")).toBe(false);
    expect(isAiFeatureEnabled(map, "jd_generation")).toBe(false);
  });
  it("does not hide controls while the map loads", () => {
    expect(isAiFeatureEnabled(undefined, "matching")).toBe(true);
  });
  it("labels features", () => {
    expect(aiFeatureLabel("nl_search")).toBe("Natural-language search");
    expect(aiFeatureLabel("new_thing")).toBe("new thing");
  });
});

describe("budget state mapping", () => {
  it("maps the 80/100/120 thresholds", () => {
    expect(budgetState(500, 1000).state).toBe("ok");
    expect(budgetState(800, 1000).state).toBe("warning");
    expect(budgetState(1000, 1000)).toMatchObject({ state: "bulk_paused", intent: "warning", color: "error" });
    expect(budgetState(1199, 1000).state).toBe("bulk_paused");
    expect(budgetState(1200, 1000)).toMatchObject({ state: "blocked", intent: "error" });
  });
  it("handles no budget and a zero budget", () => {
    expect(budgetState(5000, null)).toMatchObject({ state: "unlimited", percent: null, message: null });
    expect(budgetState(0, 0).intent).toBe("error");
  });
  it("caps the bar and places markers", () => {
    expect(budgetState(5000, 1000).bar).toBe(1);
    expect(markerPosition(130)).toBe(100);
    expect(Math.round(markerPosition(100))).toBe(77);
  });
});

describe("AI log query", () => {
  it("omits empty filters and ignores partial entity ids", () => {
    expect(aiLogQuery(EMPTY_AI_LOG_FILTERS, 1, 20)).toBe("page=1&page_size=20");
    const q = new URLSearchParams(aiLogQuery({ ...EMPTY_AI_LOG_FILTERS, feature: "matching", subjectId: "abc", status: "failed" }));
    expect(q.get("feature")).toBe("matching");
    expect(q.get("status")).toBe("failed");
    expect(q.has("subject_id")).toBe(false);
  });
});
