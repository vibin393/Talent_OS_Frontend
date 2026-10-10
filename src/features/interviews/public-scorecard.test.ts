import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { publicScorecardState } from "./public-api";
import type { PublicScorecardView } from "./types";

const view: PublicScorecardView = {
  state: "open",
  candidate_display_name: "Asha R.",
  demand_title: "Backend engineer",
  stage_name: "Technical",
  starts_at: "2026-10-06T05:00:00Z",
  ends_at: "2026-10-06T06:00:00Z",
  timezone: "Asia/Kolkata",
  display_time: "Tue 6 Oct 2026, 10:30 IST (UTC+05:30)",
  rating_scale: 5,
  recommendation_options: ["strong_yes", "yes", "no", "strong_no"],
  competencies: [{ key: "overall", label: "Overall" }],
  questions: [],
};

const AFTER = Date.parse("2026-10-06T07:00:00Z");

describe("public scorecard page states", () => {
  it("shows the form once the interview has started", () => {
    expect(publicScorecardState(view, null, AFTER).kind).toBe("form");
  });

  it("waits before the start (server state or local clock)", () => {
    expect(publicScorecardState({ ...view, state: "not_started" }, null, AFTER).kind).toBe("not_started");
    expect(publicScorecardState(view, null, Date.parse("2026-10-06T04:00:00Z")).kind).toBe("not_started");
    expect(publicScorecardState(view, new ApiError(409, "interview_not_started", "x"), AFTER).kind).toBe("not_started");
  });

  it("maps submitted and link errors", () => {
    expect(publicScorecardState({ ...view, state: "submitted" }, null, AFTER).kind).toBe("submitted");
    expect(publicScorecardState(null, new ApiError(404, "not_found", "x")).kind).toBe("not_found");
    expect(publicScorecardState(null, new ApiError(410, "link_used", "x")).kind).toBe("used");
    expect(publicScorecardState(null, new ApiError(410, "link_expired", "x")).kind).toBe("expired");
    expect(publicScorecardState(null, new ApiError(429, "rate_limited", "x")).kind).toBe("rate_limited");
    expect(publicScorecardState(null, new ApiError(500, "internal_error", "boom"))).toEqual({ kind: "error", message: "Something went wrong. Please try again." });
    expect(publicScorecardState(null, null).kind).toBe("loading");
  });
});
