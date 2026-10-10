import { describe, expect, it } from "vitest";
import { averageRating, blindedText, draftFromScorecard, hasErrors, kitFromSnapshot, toScorecardBody, validateScorecard } from "./scorecard";

const kit = kitFromSnapshot({
  name: "Backend kit",
  rating_scale: 4,
  competencies: [
    { key: "python", label: "Python", guidance: "Idioms" },
    { key: "design", label: "System design" },
    { bogus: true },
  ],
  questions: [{ key: "q1", competency_key: "python", text: "Explain the GIL" }],
});

describe("scorecard form", () => {
  it("reads the kit snapshot defensively", () => {
    expect(kit.ratingScale).toBe(4);
    expect(kit.competencies.map((c) => c.key)).toEqual(["python", "design"]);
    expect(kit.questions).toHaveLength(1);
    expect(kitFromSnapshot(null).ratingScale).toBe(5);
  });

  it("requires every competency rated within the scale and a recommendation", () => {
    const draft = draftFromScorecard(null, kit);
    let e = validateScorecard(draft, kit);
    expect(Object.keys(e.ratings)).toEqual(["python", "design"]);
    expect(e.recommendation).toBeTruthy();
    draft.ratings.python.rating = 5; // above the 4-point scale
    draft.ratings.design.rating = 3;
    draft.recommendation = "yes";
    e = validateScorecard(draft, kit);
    expect(Object.keys(e.ratings)).toEqual(["python"]);
    draft.ratings.python.rating = 4;
    expect(hasErrors(validateScorecard(draft, kit))).toBe(false);
  });

  it("builds a partial draft body", () => {
    const draft = draftFromScorecard(null, kit);
    draft.ratings.python = { rating: 3, note: "  solid " };
    draft.answers.q1 = "Good answer";
    expect(toScorecardBody(draft)).toEqual({
      ratings: [{ competency_key: "python", rating: 3, note: "solid" }],
      answers: [{ question_key: "q1", note: "Good answer" }],
      recommendation: null,
      summary: null,
    });
  });

  it("restores a saved draft", () => {
    const d = draftFromScorecard(
      { ratings: [{ competency_key: "design", rating: 2, note: "ok" }], answers: [], recommendation: "no", summary: "Meh" },
      kit,
    );
    expect(d.ratings.design).toEqual({ rating: 2, note: "ok" });
    expect(d.ratings.python.rating).toBeNull();
    expect(d.recommendation).toBe("no");
  });

  it("shows the blinded state until yours is submitted", () => {
    expect(blindedText({ hidden: true, submitted_count: 2, required_count: 3 })).toBe("2 of 3 submitted — submit yours to view");
    expect(blindedText({ hidden: false, submitted_count: 3, required_count: 3 })).toBeNull();
    expect(averageRating({ ratings: [{ competency_key: "a", rating: 3 }, { competency_key: "b", rating: 4 }] })).toBe(3.5);
  });
});
