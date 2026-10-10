import { describe, expect, it } from "vitest";
import { filtersToApi, EMPTY_FILTERS } from "@/features/search/url-state";
import {
  clampWeight,
  formatWeight,
  insightLinks,
  proficiencyLabel,
  sparkPoints,
  supplySegments,
  verificationBadge,
  weightError,
} from "./logic";

describe("weight input", () => {
  it("accepts (0, 1] with up to 2 decimals", () => {
    expect(weightError("0.8")).toBeNull();
    expect(weightError("1")).toBeNull();
    expect(weightError(".05")).toBeNull();
  });
  it("rejects bad weights", () => {
    expect(weightError("")).toBe("Enter a weight");
    expect(weightError("1.2")).toMatch(/at most 1/);
    expect(weightError("0")).toMatch(/greater than 0/);
    expect(weightError("abc")).toMatch(/number/);
    expect(weightError("0.333")).toMatch(/number/);
  });
  it("snaps and formats slider values", () => {
    expect(clampWeight(0.83)).toBe(0.85);
    expect(clampWeight(0)).toBe(0.05);
    expect(clampWeight(Number.NaN)).toBe(0.8);
    expect(formatWeight(0.8)).toBe("0.80");
  });
});

describe("verification badge", () => {
  it("maps each state", () => {
    expect(verificationBadge("verified")).toEqual({ label: "Verified", color: "success", tooltip: null });
    expect(verificationBadge("declared").color).toBe("informative");
    const inferred = verificationBadge("inferred");
    expect(inferred.color).toBe("subtle");
    expect(inferred.tooltip).toMatch(/Not verified/);
  });
  it("labels proficiency", () => {
    expect(proficiencyLabel(5)).toBe("5 · Expert");
    expect(proficiencyLabel(null)).toBe("Not recorded");
  });
});

describe("insight deep links and charts", () => {
  const row = {
    skill_key: "global:11111111-1111-1111-1111-111111111111",
    supply_total: 4,
    supply_by_proficiency: { "1": 0, "2": 1, "3": 0, "4": 1, "5": 0, unknown: 2 },
  };
  it("builds filtered list URLs", () => {
    const l = insightLinks(row, 3);
    expect(l.candidates).toBe("/candidates/search?skills=11111111-1111-1111-1111-111111111111&skills_mode=all&proficiency_min=3");
    expect(l.demands).toBe("/demands?skill_id=11111111-1111-1111-1111-111111111111&status=open");
    expect(l.verified).toContain("verification=verified");
    expect(l.bench).toBe("/bench?skill_id=11111111-1111-1111-1111-111111111111");
  });
  it("orders supply segments high to unknown", () => {
    expect(supplySegments(row).map((s) => [s.key, s.pct])).toEqual([
      ["4", 25],
      ["2", 25],
      ["unknown", 50],
    ]);
  });
  it("draws a sparkline", () => {
    expect(sparkPoints([0, 2], 10, 10)).toBe("0.0,10.0 10.0,0.0");
    expect(sparkPoints([])).toBe("");
  });
});

describe("search related-skills toggle", () => {
  it("sends expand_skills only when switched off", () => {
    expect(filtersToApi({ ...EMPTY_FILTERS, skills: ["a"] })).not.toHaveProperty("expand_skills");
    expect(filtersToApi({ ...EMPTY_FILTERS, skills: ["a"], expandSkills: false })).toHaveProperty("expand_skills", false);
  });
});
