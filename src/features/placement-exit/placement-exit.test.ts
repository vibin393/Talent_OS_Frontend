import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { exitApi } from "./api";
import {
  blockingChecks,
  canCancelCase,
  canCloseCase,
  daysBetween,
  daysLeftColor,
  exitErrorMessage,
  extensionResponseState,
  groupByOwner,
  itemLink,
  marginText,
  offboardingResponseState,
  shortfallPreview,
  shortfallText,
  templateErrors,
  trackerStep,
  wizardBlockReason,
} from "./logic";
import type { CheckResult, ExtensionPreviewOut, OffboardingItemOut } from "./types";

const check = (name: string, status: CheckResult["status"], overridable = false): CheckResult => ({ name, status, details: {}, overridable });
const preview = (checks: CheckResult[], margin: string | null = "100.00", pct: string | null = "20.00"): ExtensionPreviewOut => ({
  checks,
  margin_amount: margin,
  margin_pct: pct,
  blocking: checks.some((c) => c.status === "fail"),
});
const form = { currentEndDate: "2026-10-31", newEndDate: "2027-01-31", payRate: "", billRate: "", vendorRate: "" };

describe("extension wizard check gating", () => {
  it("enables submit when all checks pass or only warn", () => {
    expect(wizardBlockReason(form, preview([check("credentials", "pass"), check("contract_end", "warn")]), false)).toBeNull();
  });

  it("blocks on a non-overridable fail and names it", () => {
    const reason = wizardBlockReason(form, preview([check("credential_expired", "fail", false)]), false);
    expect(reason).toContain("Credential expired");
    expect(blockingChecks([check("a", "fail", false), check("b", "fail", true)]).map((c) => c.name)).toEqual(["a"]);
  });

  it("does not block on an overridable fail (exception requested later)", () => {
    expect(wizardBlockReason(form, preview([check("rate_card", "fail", true)]), false)).toBeNull();
  });

  it("blocks while checks are pending, without a date, or with a bad date/rate", () => {
    expect(wizardBlockReason(form, undefined, true)).toMatch(/Running checks/);
    expect(wizardBlockReason({ ...form, newEndDate: "" }, preview([]), false)).toMatch(/new end date/);
    expect(wizardBlockReason({ ...form, newEndDate: "2026-10-31" }, preview([]), false)).toMatch(/after the current/);
    expect(wizardBlockReason({ ...form, billRate: "-5" }, preview([]), false)).toMatch(/Rates/);
  });

  it("shows masked margin when the server nulls it", () => {
    expect(marginText(preview([], null, null), true)).toBe("Masked");
    expect(marginText(preview([]), false)).toBe("Rates unchanged");
    expect(marginText(preview([], "250.00", "12.5"), true)).toBe("250.00 (12.50 %)");
  });

  it("maps statuses onto the tracker", () => {
    expect(trackerStep("proposed")).toBe(0);
    expect(trackerStep("pending_client_confirmation")).toBe(2);
    expect(trackerStep("confirmed")).toBe(3);
    expect(trackerStep("withdrawn")).toBe(-1);
  });
});

describe("checklist close enablement", () => {
  it("enables ★ Close only when ready_to_close", () => {
    expect(canCloseCase("ready_to_close")).toBe(true);
    for (const s of ["initiated", "in_progress", "closed", "cancelled"] as const) expect(canCloseCase(s)).toBe(false);
  });

  it("allows Cancel only for open cases before the last working day", () => {
    expect(canCancelCase("in_progress", "2026-11-01", "2026-10-05")).toBe(true);
    expect(canCancelCase("in_progress", "2026-10-05", "2026-10-05")).toBe(false);
    expect(canCancelCase("ready_to_close", "2026-11-01", "2026-10-05")).toBe(false);
  });

  it("groups items by owner in template order", () => {
    const item = (id: string, position: number, owner_role: string | null): OffboardingItemOut =>
      ({ id, position, owner_role, kind: id, label: id, mandatory: true, status: "pending" }) as OffboardingItemOut;
    const groups = groupByOwner([item("c", 3, "finance"), item("a", 1, "account_manager"), item("b", 2, "finance"), item("d", 4, null)]);
    expect(groups.map((g) => g.label)).toEqual(["Account manager", "Finance", "Unassigned"]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["b", "c"]);
  });

  it("prefills the placement filter on module links", () => {
    expect(itemLink("final_timesheet_approved", "p 1")?.href).toBe("/timesheets?placement_id=p%201");
    expect(itemLink("final_invoice", "p1")?.href).toBe("/billing/runs?placement_id=p1");
    expect(itemLink("equipment_return", "p1")).toBeNull();
  });
});

describe("notice shortfall math", () => {
  it("computes max(0, notice period - days given)", () => {
    expect(daysBetween("2026-10-01", "2026-10-16")).toBe(15);
    expect(shortfallPreview("2026-10-01", "2026-10-16", 30)).toEqual({ kind: "known", daysGiven: 15, noticePeriod: 30, shortfall: 15 });
    expect(shortfallPreview("2026-10-01", "2026-11-15", 30)).toMatchObject({ shortfall: 0 });
    expect(shortfallText(shortfallPreview("2026-10-01", "2026-10-16", 30))).toBe("15 days of notice given of 30 required: shortfall of 15 days.");
  });

  it("shows days given when the notice period is unknown", () => {
    expect(shortfallText(shortfallPreview("2026-10-01", "2026-10-08", null))).toMatch(/^7 days of notice given\. .*not recorded/);
  });

  it("rejects a last working day before the notice date", () => {
    expect(shortfallPreview("2026-10-10", "2026-10-01", 30)?.kind).toBe("invalid");
    expect(shortfallPreview("", "2026-10-01", 30)).toBeNull();
  });

  it("colours days-left badges", () => {
    expect(daysLeftColor(15)).toBe("danger");
    expect(daysLeftColor(16)).toBe("warning");
    expect(daysLeftColor(30)).toBe("warning");
    expect(daysLeftColor(31)).toBe("informative");
  });
});

describe("portal response states", () => {
  it("maps extension statuses to client-facing states", () => {
    expect(extensionResponseState("pending_client_confirmation")).toBe("awaiting");
    expect(extensionResponseState("confirmed")).toBe("confirmed");
    expect(extensionResponseState("declined")).toBe("declined");
    expect(extensionResponseState("withdrawn")).toBe("closed");
    expect(extensionResponseState("pending_approval")).toBe("closed");
  });

  it("maps offboarding confirmation states", () => {
    expect(offboardingResponseState("in_progress", false)).toBe("awaiting");
    expect(offboardingResponseState("in_progress", true)).toBe("confirmed");
    expect(offboardingResponseState("cancelled", false)).toBe("closed");
  });

  it("surfaces Epic 31 error codes", () => {
    expect(exitErrorMessage(new ApiError(409, "extension_not_pending", "x"))).toMatch(/no longer waiting/);
    expect(exitErrorMessage(new ApiError(409, "items_incomplete", "x"))).toMatch(/mandatory/);
    expect(exitErrorMessage(new ApiError(409, "unknown_code", "Server says"))).toBe("Server says");
  });
});

describe("template validation and API paths", () => {
  it("validates template items", () => {
    const ok = { kind: "equipment_return", label: "Return laptop", mandatory: true, owner_role: "hr" as const, due_offset_days: 0 };
    expect(templateErrors("Default", [ok])).toBeNull();
    expect(templateErrors("", [ok])).toMatch(/Name/);
    expect(templateErrors("T", [ok, ok])).toMatch(/repeated/);
    expect(templateErrors("T", [{ ...ok, kind: "Bad Kind" }])).toMatch(/lower_snake_case/);
    expect(templateErrors("T", [{ ...ok, due_offset_days: 120 }])).toMatch(/between/);
  });

  it("exposes the API client", () => {
    expect(typeof exitApi.confirm).toBe("function");
  });
});
