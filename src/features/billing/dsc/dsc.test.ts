import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  ageBadgeColor,
  DSC_STATUS_BADGE,
  dscErrorMessage,
  formatAge,
  GENERIC_UPLOAD_ERROR,
  normalizeDscStatus,
  policyBody,
  EMPTY_POLICY_FORM,
} from "./logic";

describe("DSC queue age badge", () => {
  it("is informative up to 24 h, warning above 24 h, danger above 72 h", () => {
    expect(ageBadgeColor(0)).toBe("informative");
    expect(ageBadgeColor(23.9)).toBe("informative");
    expect(ageBadgeColor(24)).toBe("informative");
    expect(ageBadgeColor(24.1)).toBe("warning");
    expect(ageBadgeColor(72)).toBe("warning");
    expect(ageBadgeColor(72.5)).toBe("danger");
    expect(ageBadgeColor(500)).toBe("danger");
  });

  it("formats ages in hours, then days", () => {
    expect(formatAge(5.7)).toBe("5 h");
    expect(formatAge(47)).toBe("47 h");
    expect(formatAge(48)).toBe("2 d");
    expect(formatAge(76)).toBe("3 d 4 h");
    expect(formatAge(-1)).toBe("0 h");
  });
});

describe("DSC status badge", () => {
  it("hides not_required and treats an absent status (debit notes) as not_required", () => {
    expect(normalizeDscStatus(undefined)).toBe("not_required");
    expect(normalizeDscStatus(null)).toBe("not_required");
    expect(normalizeDscStatus("weird")).toBe("not_required");
    expect(DSC_STATUS_BADGE.not_required).toBeNull();
    expect(DSC_STATUS_BADGE.pending).toEqual({ color: "warning", label: "Signature pending" });
    expect(DSC_STATUS_BADGE.signed).toEqual({ color: "success", label: "DSC signed" });
    expect(DSC_STATUS_BADGE.failed).toEqual({ color: "danger", label: "Signing failed" });
  });
});

describe("DSC upload error messages", () => {
  it.each([
    ["dsc_content_mismatch", /does not match/],
    ["dsc_signature_missing", /No digital signature/],
    ["dsc_signature_invalid", /not valid/],
    ["dsc_not_pending", /no longer waiting/],
    ["unsupported_file_type", /PDF/],
  ])("maps %s to friendly text", (code, re) => {
    expect(dscErrorMessage(new ApiError(422, code, "raw server text"))).toMatch(re);
    expect(dscErrorMessage(code)).toMatch(re);
  });

  it("falls back to a generic message for unknown codes and non-API errors", () => {
    expect(dscErrorMessage(new ApiError(422, "something_else", "raw"))).toBe(GENERIC_UPLOAD_ERROR);
    expect(dscErrorMessage(new Error("boom"))).toBe(GENERIC_UPLOAD_ERROR);
  });
});

describe("DSC policy body", () => {
  it("sends null for blank optional fields and omits a blank reason", () => {
    const body = policyBody({ ...EMPTY_POLICY_FORM, gst_registration_id: "g1", signer_ref: "  ", location: "" });
    expect(body).toEqual({ gst_registration_id: "g1", client_id: null, required: true, signer_ref: null, location: null, active: true });
    expect(policyBody({ ...EMPTY_POLICY_FORM, gst_registration_id: "g1", reason: " Auth " }).reason).toBe("Auth");
  });
});
