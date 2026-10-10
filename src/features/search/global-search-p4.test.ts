import { describe, expect, it } from "vitest";
import { GROUP_LABELS, GROUP_ORDER, P4_HIT_TYPES, resultSections } from "./global-search-state";

describe("Phase 4 search groups", () => {
  it("labels and orders Proposals and Knowledge sources last", () => {
    expect(GROUP_ORDER.slice(-2)).toEqual([...P4_HIT_TYPES]);
    expect(P4_HIT_TYPES.map((t) => GROUP_LABELS[t])).toEqual(["Proposals", "Knowledge sources"]);
  });

  it("renders a Proposals group with the inbox link", () => {
    const sections = resultSections({
      groups: [
        { type: "agent_proposal", items: [{ id: "p", type: "agent_proposal", title: "Add Asha", url: "/proposals?id=p", human_id: "PRP-000001" }] },
        { type: "knowledge_source", items: [{ id: "k", type: "knowledge_source", title: "Leave policy", url: "/knowledge/sources/k" }] },
      ],
    });
    expect(sections.map((s) => [s.key, s.title])).toEqual([
      ["agent_proposal", "Proposals"],
      ["knowledge_source", "Knowledge sources"],
    ]);
    expect(sections[0].hits[0].url).toBe("/proposals?id=p");
  });
});
