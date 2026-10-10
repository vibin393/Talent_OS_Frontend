import { describe, expect, it } from "vitest";
import {
  barColor,
  dismissReasonLabel,
  formatScore,
  normalizeWeights,
  relativeTime,
  scoreColor,
  subScoreRows,
  weightErrors,
} from "./score";

describe("score colours", () => {
  it("uses success ≥70, warning 40–69, danger <40", () => {
    expect(scoreColor(100)).toBe("success");
    expect(scoreColor(70)).toBe("success");
    expect(scoreColor(69.9)).toBe("warning");
    expect(scoreColor(40)).toBe("warning");
    expect(scoreColor(39.9)).toBe("danger");
    expect(scoreColor(0)).toBe("danger");
    expect(barColor(10)).toBe("error");
    expect(barColor(85)).toBe("success");
  });

  it("formats the overall score", () => {
    expect(formatScore(82)).toBe("82");
    expect(formatScore(82.46)).toBe("82.5");
  });
});

describe("sub-score rows", () => {
  it("lists all seven in order with null as no data", () => {
    const rows = subScoreRows({ skills: 40, experience: 100, similarity: null, location: 140 });
    expect(rows.map((r) => r.key)).toEqual([
      "skills",
      "experience",
      "location",
      "compensation",
      "availability",
      "domain",
      "similarity",
    ]);
    expect(rows[0].value).toBe(40);
    expect(rows[2].value).toBe(100);
    expect(rows[3].value).toBeNull();
    expect(rows[6]).toMatchObject({ label: "Profile similarity", value: null });
  });
});

describe("weights", () => {
  it("normalizes to whole percents summing to 100", () => {
    const pct = normalizeWeights({ skills: 35, experience: 15, location: 10, compensation: 10, availability: 10, domain: 10, similarity: 10 });
    expect(pct).toEqual({ skills: 35, experience: 15, location: 10, compensation: 10, availability: 10, domain: 10, similarity: 10 });
    const thirds = normalizeWeights({ a: 1, b: 1, c: 1 });
    expect(Object.values(thirds).reduce((s, v) => s + v, 0)).toBe(100);
    expect(normalizeWeights({ a: 0, b: 0 })).toEqual({ a: 0, b: 0 });
  });

  it("mirrors the API bounds", () => {
    expect(weightErrors({ skills: 35, experience: 15 })).toEqual({});
    expect(weightErrors({ skills: 10, experience: 61 })).toEqual({
      skills: "Must be at least 15",
      experience: "Must be between 0 and 60",
    });
    expect(weightErrors({ skills: 0 }).weights).toBe("At least one weight must be above 0");
  });
});

describe("labels", () => {
  it("labels dismiss reasons and relative times", () => {
    expect(dismissReasonLabel("skills_gap")).toBe("Skills gap");
    expect(dismissReasonLabel(null)).toBe("Dismissed");
    const now = Date.parse("2026-09-30T12:00:00Z");
    expect(relativeTime("2026-09-30T11:57:00Z", now)).toBe("3 min ago");
    expect(relativeTime("2026-09-30T11:59:40Z", now)).toBe("just now");
    expect(relativeTime("2026-09-30T09:00:00Z", now)).toBe("3 h ago");
    expect(relativeTime(null, now)).toBe("never");
  });
});
