import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  contractActions,
  dayBefore,
  gstinRequired,
  poProgressColor,
  poProgressValue,
  poValidity,
  rateCheckView,
  rateExceptionInfo,
  rateExceptionMessage,
  supersededEndDate,
} from "./format";

describe("rate check badge states", () => {
  it("labels each result", () => {
    expect(rateCheckView("ok", { min_bill_rate: "1200", max_bill_rate: "1800" }, "INR").label).toMatch(/^Within rate card \(/);
    expect(rateCheckView("out_of_range")).toEqual({ label: "Outside rate card — needs approval", color: "warning", needsApproval: true });
    expect(rateCheckView("vendor_rate_exceeded").needsApproval).toBe(true);
    expect(rateCheckView("no_matching_line").label).toBe("No matching rate card line");
    expect(rateCheckView("not_validated")).toMatchObject({ label: "Not validated", needsApproval: false });
    expect(rateCheckView(undefined).label).toBe("Not checked");
  });

  it("reads 409 rate exceptions", () => {
    const e = new ApiError(409, "rate_exception_required", "x", { approval_request_id: "req-1", min: "1200", max: "1800" });
    const info = rateExceptionInfo(e);
    expect(info).toEqual({ code: "rate_exception_required", approvalRequestId: "req-1", min: "1200", max: "1800" });
    expect(rateExceptionMessage(info!)).toContain("1200–1800");
    expect(rateExceptionInfo(new ApiError(409, "transition_not_allowed", "x"))).toBeNull();
    expect(rateExceptionInfo(new Error("x"))).toBeNull();
    expect(rateExceptionMessage({ code: "rate_exception_pending", approvalRequestId: null, min: null, max: null })).toMatch(/waiting/);
  });
});

describe("publish dialog end date", () => {
  it("ends the current version the day before the new start", () => {
    expect(dayBefore("2026-11-01")).toBe("2026-10-31");
    expect(dayBefore("2026-03-01")).toBe("2026-02-28");
    expect(dayBefore("2028-03-01")).toBe("2028-02-29");
    expect(supersededEndDate("2026-01-01", "2026-11-01")).toBe("2026-10-31");
  });

  it("returns null without a current version or on overlap", () => {
    expect(supersededEndDate(null, "2026-11-01")).toBeNull();
    expect(supersededEndDate("2026-11-01", "2026-11-01")).toBeNull();
    expect(supersededEndDate("2026-11-01", "2026-10-01")).toBeNull();
  });
});

describe("PO progress and validity", () => {
  it("colours at 80 % and 100 %", () => {
    expect(poProgressColor("79.99")).toBe("brand");
    expect(poProgressColor("80.00")).toBe("warning");
    expect(poProgressColor("100.00")).toBe("error");
    expect(poProgressColor(null)).toBe("brand");
    expect(poProgressValue("82.00")).toBeCloseTo(0.82);
    expect(poProgressValue("130")).toBe(1);
    expect(poProgressValue(null)).toBe(0);
  });

  it("derives validity from the dates", () => {
    expect(poValidity("2026-10-01", "2026-10-20", "2026-09-30")).toBe("upcoming");
    expect(poValidity("2026-10-01", "2026-10-20", "2026-10-01")).toBe("valid");
    expect(poValidity("2026-10-01", "2026-10-20", "2026-10-20")).toBe("valid");
    expect(poValidity("2026-10-01", "2026-10-20", "2026-10-21")).toBe("expired");
  });
});

describe("billing address GSTIN", () => {
  it("is required for registered / SEZ Indian addresses only", () => {
    expect(gstinRequired("registered", "IN")).toBe(true);
    expect(gstinRequired("sez", "in")).toBe(true);
    expect(gstinRequired("unregistered", "IN")).toBe(false);
    expect(gstinRequired("export", "US")).toBe(false);
    expect(gstinRequired("registered", "US")).toBe(false);
  });
});

describe("contract actions by status", () => {
  const base = { approval_chain_configured: false, approved_at: null, signed_file_id: null };
  it("offers the §5.3 actions", () => {
    expect(contractActions({ ...base, status: "draft" })).toEqual(["edit", "activate", "signature"]);
    expect(contractActions({ ...base, status: "draft", approval_chain_configured: true })).toEqual(["edit", "submit", "signature"]);
    expect(contractActions({ ...base, status: "pending_approval", approval_chain_configured: true })).toEqual(["signature"]);
    expect(contractActions({ ...base, status: "active" })).toEqual(["terminate"]);
    expect(contractActions({ ...base, status: "expired" })).toEqual([]);
    expect(contractActions({ ...base, status: "terminated" })).toEqual([]);
  });
});
