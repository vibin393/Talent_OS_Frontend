import { describe, expect, it } from "vitest";
import {
  canLinkDemand,
  canVoidReward,
  cleanProgram,
  emptyProgram,
  programErrors,
  publicReferralError,
  publicReferralScreen,
  REFERRAL_STATUSES,
  referErrorMessage,
  type ReferForm,
  referFormErrors,
  referralQuery,
  referrerStatusLabel,
  resumeError,
  ruleMatchKey,
  SELF_REFERRAL_MESSAGE,
  selfSubmitErrors,
} from "./logic";
import type { ReferralStatus } from "./types";

describe("referrer status labels", () => {
  const expected: Record<ReferralStatus, string> = {
    submitted: "Received",
    accepted: "Received",
    in_process: "In process",
    hired: "Hired",
    not_selected: "Not selected",
    duplicate: "Not selected",
    declined: "Not selected",
    expired: "Not selected",
    withdrawn: "Not selected",
  };

  it("maps all nine internal statuses to the four referrer labels", () => {
    expect(REFERRAL_STATUSES).toHaveLength(9);
    for (const s of REFERRAL_STATUSES) expect(referrerStatusLabel(s)).toBe(expected[s]);
    expect(new Set(REFERRAL_STATUSES.map(referrerStatusLabel))).toEqual(new Set(["Received", "In process", "Hired", "Not selected"]));
  });
});

describe("refer form validation", () => {
  const resume = { name: "cv.pdf", size: 1000 };
  const valid: ReferForm = { name: "Asha Rao", email: "asha@example.com", phone: "", relationship: "", note: "", resume };

  it("accepts a complete form", () => {
    expect(referFormErrors(valid, "me@company.com")).toEqual({});
  });

  it("refuses a self-referral (case-insensitive, trimmed)", () => {
    expect(referFormErrors({ ...valid, email: " Me@Company.com " }, "me@company.com").email).toBe(SELF_REFERRAL_MESSAGE);
    expect(SELF_REFERRAL_MESSAGE).toBe("You cannot refer yourself");
  });

  it("skips the self check when the referrer's email is unknown", () => {
    expect(referFormErrors(valid, null)).toEqual({});
  });

  it("requires name, a valid email and a resume", () => {
    const e = referFormErrors({ ...valid, name: " ", email: "not-an-email", resume: null });
    expect(e.name).toBeTruthy();
    expect(e.email).toMatch(/valid email/);
    expect(e.resume).toBe("Attach a resume.");
    expect(referFormErrors({ ...valid, email: "" }).email).toMatch(/Enter your friend's email/);
  });

  it("checks resume type and size", () => {
    expect(resumeError({ name: "cv.docx", size: 10 })).toBeNull();
    expect(resumeError({ name: "cv.PDF", size: 10 })).toBeNull();
    expect(resumeError({ name: "cv.png", size: 10 })).toMatch(/PDF or Word/);
    expect(resumeError({ name: "cv.pdf", size: 10 * 1024 * 1024 + 1 })).toMatch(/10 MB/);
  });

  it("maps API error codes to referrer copy", () => {
    expect(referErrorMessage({ status: 422, code: "self_referral" })).toBe(SELF_REFERRAL_MESSAGE);
    expect(referErrorMessage({ status: 409, code: "referrer_not_eligible" })).toMatch(/sourcing instead/);
    expect(referErrorMessage({ status: 409, code: "referral_exists" })).toMatch(/already been referred/);
  });
});

describe("public referral link variants", () => {
  it("renders the notice with Accept / Decline for the upload channel", () => {
    expect(publicReferralScreen({ mode: "accept", status: "open" })).toBe("accept_notice");
  });

  it("renders the self-submit form for the share channel", () => {
    expect(publicReferralScreen({ mode: "submit", status: "open" })).toBe("submit_form");
  });

  it("shows the answered state when the link was already answered", () => {
    expect(publicReferralScreen({ mode: "accept", status: "answered" })).toBe("answered");
    expect(publicReferralScreen({ mode: "submit", status: "answered" })).toBe("answered");
  });

  it("shows thank-you states after an answer", () => {
    expect(publicReferralScreen({ mode: "accept", status: "open" }, "accepted")).toBe("accepted");
    expect(publicReferralScreen({ mode: "accept", status: "open" }, "declined")).toBe("declined");
    expect(publicReferralScreen({ mode: "submit", status: "open" }, "received")).toBe("received");
  });

  it("maps 410 and 409 errors", () => {
    expect(publicReferralError({ status: 410, code: "link_expired" }).fatal).toBe(true);
    expect(publicReferralError({ status: 410, code: "gone" }).title).toMatch(/expired/);
    expect(publicReferralError({ status: 409, code: "referral_answered" }).fatal).toBe(true);
    expect(publicReferralError({ status: 409, code: "referral_exists" })).toMatchObject({ fatal: false, title: "You were already referred" });
    expect(publicReferralError({ status: 409, code: "notice_outdated" }).title).toMatch(/notice was updated/);
  });

  it("validates the self-submit form including the agreement", () => {
    const e = selfSubmitErrors({ name: "", email: "x", resume: null, agreed: false });
    expect(Object.keys(e).sort()).toEqual(["agreed", "email", "name", "resume"]);
    expect(selfSubmitErrors({ name: "A", email: "a@b.co", resume: { name: "a.pdf", size: 5 }, agreed: true })).toEqual({});
  });
});

describe("recruiter helpers", () => {
  it("builds the list query", () => {
    expect(referralQuery({ status: "accepted", demand_id: "", program_id: "p1", channel: "" }, 25, 50)).toBe(
      "?status=accepted&program_id=p1&limit=25&offset=50",
    );
  });

  it("offers link-to-opening only for accepted general referrals and void for open rewards", () => {
    expect(canLinkDemand({ status: "accepted", demand_id: null })).toBe(true);
    expect(canLinkDemand({ status: "accepted", demand_id: "d" })).toBe(false);
    expect(canLinkDemand({ status: "submitted", demand_id: null })).toBe(false);
    expect(canVoidReward("pending_condition")).toBe(true);
    expect(canVoidReward("eligible")).toBe(true);
    expect(canVoidReward("approved")).toBe(false);
  });
});

describe("program editor", () => {
  const now = new Date(2026, 9, 6);

  it("flags duplicate rule matches, empty matches and bad amounts", () => {
    const p = emptyProgram(now);
    p.name = "Senior bonus";
    p.reward_rules = [
      { match: { seniority_level: "senior" }, amount: "25000", currency: "INR" },
      { match: { seniority_level: "senior" }, amount: "0", currency: "INR" },
      { match: { demand_id: null }, amount: "100", currency: "inr" },
    ];
    const e = programErrors(p);
    expect(e.rule_1).toMatch(/already matches/);
    expect(e.rule_1_amount).toBeTruthy();
    expect(e.rule_2).toMatch(/Choose what/);
    expect(e.rule_2_currency).toBeTruthy();
    expect(e.rule_0).toBeUndefined();
  });

  it("detects the match key even before a value is chosen", () => {
    expect(ruleMatchKey({ match: { demand_id: null }, amount: "1", currency: "INR" })).toBe("demand_id");
    expect(ruleMatchKey({ match: {}, amount: "1", currency: "INR" })).toBeNull();
  });

  it("requires a scope when not all openings are eligible, and cleans the payload", () => {
    const p = emptyProgram(now);
    p.name = " Program ";
    p.eligible_demands = { ...p.eligible_demands, all: false };
    expect(programErrors(p).eligible_demands).toBeTruthy();
    p.eligible_demands.seniority_levels = ["senior"];
    p.default_amount = " 1000.50 ";
    p.exclusions.excluded_role_keys = [" recruiter", "", "hr "];
    expect(programErrors(p)).toEqual({});
    const c = cleanProgram(p);
    expect(c.name).toBe("Program");
    expect(c.default_amount).toBe("1000.50");
    expect(c.exclusions.excluded_role_keys).toEqual(["recruiter", "hr"]);
    expect(c.valid_from).toBe("2026-10-06");
  });
});
