import { describe, expect, it } from "vitest";
import { RULE_LABELS, ruleLabel, UNLISTED_CAPTION } from "./logic";

describe("recording policy labels", () => {
  it("uses the three rule labels", () => {
    expect(RULE_LABELS).toEqual({
      not_permitted: "Not permitted",
      candidate_consent: "Permitted with the candidate's consent",
      all_party_consent: "Permitted with everyone's consent",
    });
    expect(ruleLabel("unknown")).toBe("Not permitted");
    expect(UNLISTED_CAPTION).toBe("Anywhere not listed: not permitted.");
  });
});
