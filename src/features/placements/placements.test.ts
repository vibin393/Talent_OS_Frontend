import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { bankErrors, maskedAccount } from "@/features/work-portal/validation";
import { placementQuery } from "./api";
import { daysToStartLabel, isRate, maskedRate, placementFlags, unmetGatesFrom } from "./format";
import { joiningErrorMessage, joiningScreen } from "./public-joining-logic";

describe("rate and margin masking", () => {
  it("masks rates without compensation:view and never shows 0", () => {
    expect(maskedRate(null, "INR", false)).toBe("••••");
    expect(maskedRate("1500.00", "INR", false)).toBe("••••");
    expect(maskedRate(null, "INR", true)).toBe("—");
    expect(maskedRate("1500.00", "INR", true)).toContain("1,500.00");
  });

  it("validates rate inputs", () => {
    expect(isRate("1200")).toBe(true);
    expect(isRate("1200.1234")).toBe(true);
    expect(isRate("12.12345")).toBe(false);
    expect(isRate("-1")).toBe(false);
  });
});

describe("Mark Joined 409", () => {
  it("extracts the unmet gates of start_gates_unmet only", () => {
    const err = new ApiError(409, "start_gates_unmet", "Start gates are not met", {
      gates: [{ id: "g1", kind: "bgv", label: "Background verification", source_ref: "c1", status: "pending" }],
    });
    expect(unmetGatesFrom(err)).toEqual([{ id: "g1", kind: "bgv", label: "Background verification", source_ref: "c1", status: "pending" }]);
    expect(unmetGatesFrom(new ApiError(409, "transition_not_allowed", "x"))).toBeNull();
    expect(unmetGatesFrom(new Error("boom"))).toBeNull();
  });
});

describe("list flags and query", () => {
  it("derives the dropout / setup flags", () => {
    const flags = placementFlags({ ending_soon: false, non_compliant: false, compliance_blocked: true, dropout_risk: true, setup_items: ["po_missing"] });
    expect(flags).toEqual(["Non-compliant", "Dropout risk", "Setup incomplete"]);
  });

  it("repeats status filters and drops empty values", () => {
    expect(placementQuery({ status: ["active", "pre_joining"], q: "", view: "ending_30" })).toBe("?status=active&status=pre_joining&view=ending_30");
  });

  it("labels days to start", () => {
    expect(daysToStartLabel(0)).toBe("Today");
    expect(daysToStartLabel(1)).toBe("In 1 day");
    expect(daysToStartLabel(-2)).toBe("2 days ago");
  });
});

describe("bank form validation", () => {
  const ok = { holder_name: "Asha Rao", account_number: "123456789012", account_number_confirm: "123456789012", ifsc: "hdfc0001234" };
  it("accepts a valid form (IFSC upper-cased)", () => {
    expect(bankErrors(ok)).toEqual({});
  });
  it("refuses mismatched numbers, bad IFSC and short accounts", () => {
    expect(bankErrors({ ...ok, account_number_confirm: "123" }).account_number_confirm).toMatch(/do not match/);
    expect(bankErrors({ ...ok, ifsc: "HDFC1234567" }).ifsc).toMatch(/IFSC/);
    expect(bankErrors({ ...ok, account_number: "12", account_number_confirm: "12" }).account_number).toBeTruthy();
  });
  it("masks the account", () => {
    expect(maskedAccount("9012")).toBe("•••• 9012");
    expect(maskedAccount(null)).toBe("—");
  });
});

describe("joining confirmation link states", () => {
  it("starts on the form unless already responded", () => {
    expect(joiningScreen({ status: "open", joining: { responded: false, client_name: null, role_title: null, planned_start_date: "2026-11-02", candidate_first_name: null } })).toBe("form");
    expect(joiningScreen({ status: "responded" })).toBe("responded");
  });
  it("maps link errors", () => {
    expect(joiningErrorMessage(new ApiError(410, "link_used", "used"))).toMatch(/already been used/);
    expect(joiningErrorMessage(new ApiError(404, "link_invalid", "x"))).toMatch(/not valid/);
  });
});
