import { describe, expect, it } from "vitest";
import { AI_FEATURE_COST_NOTES, AI_FEATURE_KEYS, aiFeatureLabel, isAiFeatureEnabled, withDefaultAiFeatures } from "./ai-features";
import { aiLogQuery, EMPTY_AI_LOG_FILTERS } from "./ai-log-query";

describe("document extraction AI switch", () => {
  it("shows the switch off by default when the server map omits it", () => {
    const map = withDefaultAiFeatures({ matching: true });
    expect(map).toEqual({ document_extraction: false, matching: true });
    expect(isAiFeatureEnabled(map, "document_extraction")).toBe(false);
  });
  it("keeps the server's value when present", () => {
    expect(withDefaultAiFeatures({ document_extraction: true }).document_extraction).toBe(true);
  });
  it("is labelled, carries a cost note and is filterable in the AI log", () => {
    expect(aiFeatureLabel("document_extraction")).toBe("Document extraction");
    expect(AI_FEATURE_COST_NOTES.document_extraction).toMatch(/budget/);
    expect(AI_FEATURE_KEYS).toContain("document_extraction");
    expect(aiLogQuery({ ...EMPTY_AI_LOG_FILTERS, feature: "document_extraction" })).toBe("feature=document_extraction");
  });
});
