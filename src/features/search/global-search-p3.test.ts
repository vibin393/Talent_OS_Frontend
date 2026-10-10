import { describe, expect, it } from "vitest";
import { GROUP_LABELS, GROUP_ORDER, P3_HIT_TYPES, type QuickHit, resultSections } from "./global-search-state";

describe("Phase 3 search groups", () => {
  it("labels and orders the eight new types after the P1/P2 groups", () => {
    const start = GROUP_ORDER.indexOf(P3_HIT_TYPES[0]);
    expect(GROUP_ORDER.slice(start, start + 8)).toEqual([...P3_HIT_TYPES]);
    expect(P3_HIT_TYPES.map((t) => GROUP_LABELS[t])).toEqual([
      "Talent pools",
      "Campaigns",
      "Assessments",
      "Campus drives",
      "Recruitment events",
      "Projects",
      "Immigration cases",
      "Reports",
    ]);
  });

  it("renders P3 groups in order and pins an exact project id", () => {
    const prj: QuickHit = { id: "p", type: "project", title: "Apollo", url: "/projects/p", human_id: "PRJ-000042", exact: true };
    const sections = resultSections({
      exact: prj,
      groups: [
        { type: "immigration_case", items: [{ id: "i", type: "immigration_case", title: "Case", url: "/immigration/cases/i" }] },
        { type: "project", items: [prj] },
        { type: "talent_pool", items: [{ id: "t", type: "talent_pool", title: "Java pool", url: "/talent-pools/t" }] },
      ],
    });
    expect(sections.map((s) => s.key)).toEqual(["top", "talent_pool", "immigration_case"]);
    expect(sections[0].hits[0].url).toBe("/projects/p");
  });
});
