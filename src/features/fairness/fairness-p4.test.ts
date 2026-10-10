import { describe, expect, it } from "vitest";
import { defaultRunDraft, runCreatePayload, runSelectionPoints, SELECTION_POINT_LABELS } from "./logic";

describe("agent selection points (Epic 65)", () => {
  it("offers agent points only when available", () => {
    const pts = runSelectionPoints([
      { key: "agent_shortlist_added", available: true },
      { key: "agent_draft_rating_accepted", available: false },
    ]);
    expect(pts).toContain("agent_shortlist_added");
    expect(pts).not.toContain("agent_draft_rating_accepted");
    expect(pts).not.toContain("agent_screening_flag_advanced");
    expect(runSelectionPoints(undefined)).toEqual(["stage_transition", "ai_match_threshold", "ai_screening_pass", "assessment_pass"]);
    expect(SELECTION_POINT_LABELS.agent_shortlist_added).toBe("Agent shortlist → added to pipeline");
  });

  it("sends the screening source and the accepted share", () => {
    const d = defaultRunDraft(new Date(2026, 9, 7));
    expect(runCreatePayload({ ...d, selection_point: "agent_screening_flag_advanced", source: "voice" }).params).toEqual({ source: "voice" });
    expect(runCreatePayload({ ...d, selection_point: "agent_draft_rating_accepted", min_accepted_share: 0.5 }).params).toEqual({
      min_accepted_share: 0.5,
    });
  });
});
