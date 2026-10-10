import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { labelColor, portalErrorState, visiblePortalNav } from "./labels";
import { noticeIntro, noticeScreen } from "./public-notice-logic";
import {
  ATTESTATION_TEXT,
  compareDecimal,
  EMPTY_SUBMIT,
  SUBMIT_ERROR_COPY,
  submitErrorCopy,
  toFormData,
  validateSubmission,
} from "./submit-logic";

const valid = { ...EMPTY_SUBMIT, fullName: "Ravi Kumar", email: "ravi@mail.example.com", vendorRate: "1300", attestation: true };

describe("submit form validation", () => {
  it("accepts a valid submission", () => {
    expect(validateSubmission(valid, "1350")).toEqual({});
  });

  it("caps the rate at the release maximum (Decimal compare, no floats)", () => {
    expect(validateSubmission({ ...valid, vendorRate: "1400" }, "1350.0000").vendorRate).toMatch(/above the maximum/);
    expect(validateSubmission({ ...valid, vendorRate: "1350.0000" }, "1350")).toEqual({});
    expect(validateSubmission({ ...valid, vendorRate: "1350.0001" }, "1350").vendorRate).toBeDefined();
    expect(validateSubmission({ ...valid, vendorRate: "abc" }, null).vendorRate).toBeDefined();
    expect(compareDecimal("0.3", "0.30")).toBe(0);
    expect(compareDecimal("999999999.9999", "1000000000")).toBe(-1);
  });

  it("requires the attestation", () => {
    expect(validateSubmission({ ...valid, attestation: false }, null).attestation).toBe("Confirm the attestation to submit");
    expect(ATTESTATION_TEXT).toMatch(/authorised us to represent them/);
  });

  it("checks email and resume type", () => {
    expect(validateSubmission({ ...valid, email: "nope" }, null).email).toBeDefined();
    const exe = new File(["x"], "cv.exe");
    expect(validateSubmission({ ...valid, resume: exe }, null).resume).toMatch(/PDF or Word/);
  });

  it("maps every server code to copy", () => {
    for (const code of [
      "vendor_rate_above_max",
      "vendor_limit_reached",
      "deadline_passed",
      "release_closed",
      "vendor_not_active",
      "file_rejected",
      "already_in_review",
      "resume_locked",
      "attestation_required",
      "rate_unit_mismatch",
    ]) {
      expect(SUBMIT_ERROR_COPY[code]).toBeTruthy();
    }
    expect(submitErrorCopy("unknown_code", "fallback")).toBe("fallback");
  });

  it("builds the multipart body", () => {
    const form = toFormData({ ...valid, experienceYears: "6.5", noticeDays: "30" }, "hour", "INR");
    expect(form.get("vendor_rate")).toBe("1300");
    expect(form.get("attestation")).toBe("true");
    expect(form.get("total_experience_months")).toBe("78");
    expect(form.get("rate_unit")).toBe("hour");
  });
});

describe("labels and access", () => {
  it("colours vendor labels", () => {
    expect(labelColor("Placed")).toBe("success");
    expect(labelColor("Not selected")).toBe("danger");
    expect(labelColor("Tenant custom label")).toBe("informative");
  });

  it("filters nav by portal permissions", () => {
    const hrefs = visiblePortalNav(["releases:view"]).map((n) => n.href);
    expect(hrefs).toContain("/vendor/releases");
    expect(hrefs).not.toContain("/vendor/statements");
  });

  it("turns a 403 into the FR-82 access-denied state", () => {
    const e = new ApiError(403, "portal_permission_required", "No", { action: "statements:view", ask: "account_manager" });
    expect(portalErrorState(e)).toEqual({ kind: "forbidden", action: "statements:view", ask: "your Account Manager" });
    expect(portalErrorState(new ApiError(404, "not_found", "x"))).toEqual({ kind: "not_found" });
  });
});

describe("vendor data notice renderer", () => {
  it("starts on the right screen and names the role", () => {
    expect(noticeScreen("pending")).toBe("notice");
    expect(noticeScreen("granted")).toBe("granted");
    expect(noticeScreen("withdrawn")).toBe("withdrawn");
    const intro = noticeIntro({ tenant_name: "Acme Staffing", job_title: "Data Engineer", candidate_first_name: "Ravi" });
    expect(intro).toContain("Hello Ravi");
    expect(intro).toContain('"Data Engineer"');
    expect(intro).not.toMatch(/vendor name|TalentBridge/);
  });
});
