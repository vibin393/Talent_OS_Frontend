import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { canAccept, candidateOfferState, expiryCountdown, responseError } from "./candidate-offer";

const NOW = Date.parse("2026-10-05T00:00:00Z");
const open = { status: "released" as const, can_respond: true, expires_at: "2026-10-08T00:00:00Z", response: null };

describe("candidate offer view", () => {
  it("enables Accept only with a typed name and agreement", () => {
    expect(canAccept("", true)).toBe(false);
    expect(canAccept("  ", true)).toBe(false);
    expect(canAccept("Asha Rao", false)).toBe(false);
    expect(canAccept("Asha Rao", true)).toBe(true);
  });

  it("derives the page state", () => {
    expect(candidateOfferState(open, NOW)).toBe("open");
    expect(candidateOfferState({ ...open, status: "viewed" }, NOW)).toBe("open");
    expect(candidateOfferState({ ...open, expires_at: "2026-10-04T00:00:00Z" }, NOW)).toBe("expired");
    expect(candidateOfferState({ ...open, status: "withdrawn", can_respond: false }, NOW)).toBe("withdrawn");
    expect(
      candidateOfferState({ ...open, status: "accepted", can_respond: false, response: { decision: "accepted", version_no: 2, typed_name: "A", decided_at: "x" } }, NOW),
    ).toBe("accepted");
    expect(candidateOfferState({ ...open, status: "declined", can_respond: false }, NOW)).toBe("declined");
  });

  it("maps response errors", () => {
    expect(responseError(new ApiError(422, "name_mismatch", "x")).kind).toBe("name_mismatch");
    expect(responseError(new ApiError(409, "offer_version_changed", "x")).message).toBe("This offer was updated — reload to review.");
    expect(responseError(new ApiError(410, "offer_expired", "x")).kind).toBe("expired");
    expect(responseError(new ApiError(410, "link_used", "x")).kind).toBe("not_open");
    expect(responseError(new ApiError(404, "not_found", "x")).kind).toBe("not_found");
    expect(responseError(new ApiError(429, "rate_limited", "x")).kind).toBe("rate_limited");
    expect(responseError(new Error("boom")).kind).toBe("other");
  });

  it("formats the expiry countdown", () => {
    expect(expiryCountdown("2026-10-08T00:00:00Z", NOW)).toBe("Expires in 3 days");
    expect(expiryCountdown("2026-10-05T05:00:00Z", NOW)).toBe("Expires in 5 hours");
    expect(expiryCountdown("2026-10-05T00:10:00Z", NOW)).toBe("Expires in 10 minutes");
    expect(expiryCountdown("2026-10-04T00:00:00Z", NOW)).toBe("Expired");
    expect(expiryCountdown(null, NOW)).toBeNull();
  });
});
