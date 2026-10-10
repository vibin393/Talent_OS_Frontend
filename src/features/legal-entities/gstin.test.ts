import { describe, expect, it } from "vitest";
import { fiscalYearOf, gstinCheckCharacter, gstinHint, maskAccount, missingLabel } from "./gstin";
import { readinessBannerText } from "./readiness";
import { previewNumber } from "./series";

const valid = (state = "29", pan = "ABCDE1234F") => {
  const first14 = `${state}${pan}1Z`;
  return first14 + gstinCheckCharacter(first14);
};

describe("GSTIN hints (server authoritative)", () => {
  it("accepts a valid Karnataka GSTIN and flags state, PAN and checksum", () => {
    expect(gstinHint(valid())).toBeNull();
    expect(gstinHint(valid(), { stateCode: "29", pan: "ABCDE1234F" })).toBeNull();
    expect(gstinHint(valid("27"), { stateCode: "29" })).toMatch(/state code 27/);
    expect(gstinHint(valid(), { pan: "ZZZZZ9999Z" })).toMatch(/PAN/);
    const good = valid();
    const bad = good.slice(0, 14) + (good[14] === "A" ? "B" : "A");
    expect(gstinHint(bad)).toMatch(/check character/);
    expect(gstinHint("29ABC")).toMatch(/15 characters/);
    expect(gstinHint("")).toBeNull();
  });

  it("formats readiness gaps, FY tokens and masked accounts", () => {
    expect(missingLabel(["pan", "principal_gst_registration", "bank_account"])).toBe(
      "PAN, GST registration and default bank account",
    );
    expect(missingLabel(["signatory"])).toBe("authorised signatory");
    expect(fiscalYearOf(new Date(2026, 3, 1))).toBe("26-27");
    expect(fiscalYearOf(new Date(2027, 2, 31))).toBe("26-27");
    expect(maskAccount("1234")).toBe("••••1234");
  });

  it("readiness banner text", () => {
    expect(readinessBannerText({ legal_entity_id: "x", ready_for_invoicing: true, missing: [] })).toBeNull();
    expect(
      readinessBannerText({ legal_entity_id: "x", ready_for_invoicing: false, missing: ["pan", "bank_account"] }),
    ).toBe("Complete PAN and default bank account before your first Invoice.");
  });
});

describe("document series preview (P2 fix)", () => {
  it("formats prefix, financial year and padded number with the separator", () => {
    expect(previewNumber("INV", "YY-YY", "/", 4)).toBe("INV/25-26/0001");
    expect(previewNumber("", "none", "-", 3)).toBe("001");
    expect(previewNumber("CN", "YYYY-YY", "", 2)).toBe("CN2025-2601");
  });
});
