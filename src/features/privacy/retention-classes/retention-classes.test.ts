import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { retentionClassErrorMessage } from "./api";
import {
  activeClasses,
  bindingBadge,
  canExecuteExpiry,
  canStartExpiry,
  formatPeriod,
  isReportOnlyClass,
  minPeriod,
  periodError,
  retainedSentence,
} from "./format";
import type { ClassExpiryPreview, RetentionClass } from "./types";

const cls = (over: Partial<RetentionClass> = {}): RetentionClass => ({
  id: "c1",
  key: "bgv_evidence",
  label: "BGV evidence",
  period_months: 12,
  anchor: "adjudicated_at",
  expiry_action: "delete",
  is_system: true,
  floor_months: 12,
  auto_execute: false,
  archived_at: null,
  ...over,
});

const preview = (over: Partial<ClassExpiryPreview> = {}): ClassExpiryPreview => ({
  run_id: "r1",
  class_key: "bgv_evidence",
  report_only: false,
  reason: null,
  total: 3,
  by_table: [{ table: "bgv_documents", count: 3, skipped_legal_hold: 1, skipped_override: 0 }],
  valid_until: null,
  ...over,
});

describe("retention floor validation", () => {
  it("refuses a period below the statutory floor and cites it", () => {
    expect(periodError(6, 12)).toBe("The statutory minimum for this class is 12 months.");
    expect(periodError(12, 12)).toBeNull();
    expect(periodError(96, 12)).toBeNull();
  });
  it("refuses empty, fractional and out-of-range values", () => {
    expect(periodError(null, 12)).toMatch(/whole number/);
    expect(periodError(12.5, null)).toMatch(/whole number/);
    expect(periodError(0, null)).toMatch(/at least 1/);
    expect(periodError(5000, null)).toMatch(/at most/);
  });
  it("uses the floor as the SpinButton minimum", () => {
    expect(minPeriod(cls())).toBe(12);
    expect(minPeriod(cls({ floor_months: null }))).toBe(1);
  });
  it("maps the 422 below_statutory_floor to a message citing the floor", () => {
    const e = new ApiError(422, "below_statutory_floor", "x", { floor_months: 12 });
    expect(retentionClassErrorMessage(e)).toBe("The period cannot be shorter than the statutory minimum of 12 months.");
    expect(retentionClassErrorMessage(new ApiError(409, "system_class", "x"))).toMatch(/cannot be archived/);
  });
  it("formats periods in months and years", () => {
    expect(formatPeriod(96)).toBe("96 months (8 years)");
    expect(formatPeriod(18)).toBe("18 months");
    expect(formatPeriod(1)).toBe("1 month");
  });
});

describe("expiry confirm gating", () => {
  it("requires the exact typed EXPIRE", () => {
    expect(canExecuteExpiry(preview(), "")).toBe(false);
    expect(canExecuteExpiry(preview(), "expire")).toBe(false);
    expect(canExecuteExpiry(preview(), " EXPIRE ")).toBe(true);
  });
  it("never executes report-only (financial), empty or run-less previews", () => {
    expect(canExecuteExpiry(preview({ report_only: true, reason: "financial" }), "EXPIRE")).toBe(false);
    expect(canExecuteExpiry(preview({ total: 0 }), "EXPIRE")).toBe(false);
    expect(canExecuteExpiry(preview({ run_id: null }), "EXPIRE")).toBe(false);
    expect(canExecuteExpiry(null, "EXPIRE")).toBe(false);
    expect(canStartExpiry(preview({ report_only: true }))).toBe(false);
    expect(canStartExpiry(preview())).toBe(true);
  });
  it("treats the financial class as report-only", () => {
    expect(isReportOnlyClass(cls({ key: "financial", expiry_action: "anonymize" }))).toBe(true);
    expect(isReportOnlyClass(cls({ expiry_action: "report_only" }))).toBe(true);
    expect(isReportOnlyClass(cls())).toBe(false);
  });
});

describe("classes, bindings and retained summary", () => {
  it("hides archived classes and lists system classes first", () => {
    const out = activeClasses([
      cls({ id: "a", label: "Zeta", is_system: false }),
      cls({ id: "b", label: "Alpha", archived_at: "2026-01-01T00:00:00Z" }),
      cls({ id: "c", label: "Beta" }),
    ]);
    expect(out.map((c) => c.id)).toEqual(["c", "a"]);
  });
  it("labels pending bindings with the owning epic", () => {
    expect(bindingBadge({ status: "pending", owner_epic: "16" })).toEqual({ label: "Pending (Epic 16)", color: "warning" });
    expect(bindingBadge({ status: "pending", owner_epic: "Epic 22" }).label).toBe("Pending (Epic 22)");
    expect(bindingBadge({ status: "pending", owner_epic: null }).label).toBe("Pending");
    expect(bindingBadge({ status: "registered", owner_epic: null })).toEqual({ label: "Registered", color: "success" });
  });
  it("summarises what was retained, latest date per class", () => {
    const s = retainedSentence(
      [
        { class: "financial", table: "invoices", count: 3, retained_until: "2035-03-31", reason: "statutory" },
        { class: "financial", table: "timesheets", count: 9, retained_until: "2034-03-31", reason: "statutory" },
        { class: "bgv_evidence", table: "bgv_documents", count: 1, retained_until: null, reason: "legal_hold" },
      ],
      (iso) => iso,
    );
    expect(s).toBe("Retained: financial (until 2035-03-31), bgv_evidence");
    expect(retainedSentence([], (x) => x)).toBe("Nothing was retained.");
  });
});
