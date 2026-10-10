import { describe, expect, it } from "vitest";
import type { PortalInterview, PortalProfile } from "@/lib/api/types";
import { buildIcs, formatMoney, namesMatch, tokenFromFragment } from "./format";
import { validateAccept, validateDecline, validatePrivacyRequest, validateWithdraw } from "./forms";
import { profileDraft, profileUpdate, validateProfile } from "./profile-form";
import { verifyErrorCopy } from "./verify";
import { ApiError } from "@/lib/api/errors";

describe("verify link", () => {
  it("reads the token from the #t= fragment only", () => {
    expect(tokenFromFragment("#t=abc123")).toBe("abc123");
    expect(tokenFromFragment("t=abc")).toBe("abc");
    expect(tokenFromFragment("#token=abc")).toBe("");
    expect(tokenFromFragment("")).toBe("");
  });

  it("has specific copy for expired, used, revoked and invalid links", () => {
    expect(verifyErrorCopy(new ApiError(410, "link_expired", "x")).title).toMatch(/expired/);
    expect(verifyErrorCopy(new ApiError(410, "link_used", "x")).title).toMatch(/already used/);
    expect(verifyErrorCopy(new ApiError(410, "link_revoked", "x")).canResend).toBe(true);
    expect(verifyErrorCopy(new ApiError(404, "link_invalid", "x")).title).toMatch(/recognise/);
  });
});

describe("withdraw dialog", () => {
  const reasons = [{ code: "other_offer" }, { code: "not_interested" }];
  it("requires a listed reason", () => {
    expect(validateWithdraw({ reason: "", note: "" }, reasons)).toHaveProperty("reason");
    expect(validateWithdraw({ reason: "made_up", note: "" }, reasons)).toHaveProperty("reason");
    expect(validateWithdraw({ reason: "other_offer", note: "" }, reasons)).toEqual({});
    expect(validateWithdraw({ reason: "other_offer", note: "x".repeat(2001) }, reasons)).toHaveProperty("note");
  });
});

describe("offer accept dialog", () => {
  it("requires the typed name to match the name on the offer and the agreement", () => {
    expect(validateAccept({ typedName: "", agreed: true }, "Asha Rao")).toHaveProperty("typedName");
    expect(validateAccept({ typedName: "Someone Else", agreed: true }, "Asha Rao")).toHaveProperty("typedName");
    expect(validateAccept({ typedName: "  asha   RAO ", agreed: false }, "Asha Rao")).toEqual({ agreed: expect.any(String) });
    expect(validateAccept({ typedName: "Asha Rao", agreed: true }, "Asha Rao")).toEqual({});
  });
  it("normalises names", () => {
    expect(namesMatch("Ａｓｈａ Rao", "Asha Rao")).toBe(true);
    expect(namesMatch("", "Asha")).toBe(false);
  });
  it("limits the decline reason", () => {
    expect(validateDecline("fine")).toEqual({});
    expect(validateDecline("x".repeat(2001))).toHaveProperty("reason");
  });
});

describe("privacy requests", () => {
  it("requires a kind and details", () => {
    expect(Object.keys(validatePrivacyRequest({ kind: "", details: "", fields: [] })).sort()).toEqual(["details", "kind"]);
    expect(validatePrivacyRequest({ kind: "erasure", details: "Please erase", fields: [] })).toEqual({});
  });
});

describe("profile form", () => {
  const profile: PortalProfile = {
    full_name: "Asha Rao",
    emails: ["asha@example.com"],
    phones: ["+919876543210"],
    location: { city: "Pune", state: null, country: "India" },
    links: [],
    headline: null,
    notice_period_days: 30,
    expected_compensation: null,
    willing_to_relocate: null,
    work_authorization: null,
  };
  it("sends only changed fields", () => {
    const a = profileDraft(profile);
    expect(profileUpdate(a, a)).toEqual({});
    expect(profileUpdate(a, { ...a, city: "Mumbai", comp_amount: "2500000", comp_currency: "inr", comp_unit: "annual" })).toEqual({
      location: { city: "Mumbai", state: null, country: "India" },
      expected_compensation: { amount: "2500000", currency: "INR", unit: "annual" },
    });
  });
  it("validates notice period and pay", () => {
    const a = profileDraft(profile);
    expect(validateProfile({ ...a, notice_period_days: "400" })).toHaveProperty("notice_period_days");
    expect(validateProfile({ ...a, comp_amount: "12,00" })).toHaveProperty("comp_amount");
  });
});

describe("interviews", () => {
  const interview: PortalInterview = {
    id: "i1",
    title: "Java developer, Acme",
    round_name: "Technical",
    starts_at: "2026-10-05T09:30:00Z",
    ends_at: "2026-10-05T10:30:00Z",
    timezone: "Asia/Kolkata",
    mode: "video",
    location: null,
    join_url: "https://meet.example.com/abc",
    status: "scheduled",
  };
  it("builds a valid .ics event", () => {
    const ics = buildIcs(interview, "Acme", new Date("2026-10-01T00:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261005T093000Z");
    expect(ics).toContain("DTEND:20261005T103000Z");
    expect(ics).toContain(String.raw`SUMMARY:Java developer\, Acme – Technical`);
    expect(ics).toContain("UID:i1@talent-os");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });
  it("formats money", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney({ amount: "100", currency: "USD" }, "hour")).toMatch(/100.*per hour/);
  });
});
