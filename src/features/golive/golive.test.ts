import { describe, expect, it } from "vitest";
import { goLiveUrls } from "./api";
import { availableAfterText, canApply, goLiveStep, isCsvFile, isValidating, orderedKinds, resultCounts, rowDetail, rowsOf } from "./format";
import type { GoLiveImport, GoLiveKindOut } from "./types";

const imp = (over: Partial<GoLiveImport> = {}): GoLiveImport => ({
  id: "i1",
  kind: "workers",
  status: "previewed",
  row_count: 53,
  valid_count: 50,
  error_count: 3,
  applied_count: 0,
  failed_count: 0,
  skipped_count: 0,
  errors: [],
  created_at: "2026-10-01T00:00:00Z",
  applied_at: null,
  ...over,
});

const kind = (k: string, available = true, owner: string | null = null): GoLiveKindOut => ({
  kind: k,
  label: k,
  available,
  owner_epic: owner,
  depends_on: null,
});

describe("go-live stepper", () => {
  it("walks Upload -> Validate -> Preview -> Results", () => {
    expect(goLiveStep(null)).toBe("Upload");
    expect(goLiveStep(imp({ status: "validating" }))).toBe("Validate");
    expect(goLiveStep(imp())).toBe("Preview");
    expect(goLiveStep(imp({ status: "applied" }))).toBe("Results");
    expect(goLiveStep(imp({ status: "failed" }))).toBe("Results");
    expect(goLiveStep(imp({ status: "discarded" }))).toBe("Upload");
  });
  it("polls only while validating", () => {
    expect(isValidating(imp({ status: "validating" }))).toBe(true);
    expect(isValidating(imp())).toBe(false);
  });
  it("orders kinds Workers -> Placements -> Opening invoices -> Leave balances", () => {
    const out = orderedKinds([kind("leave_balances"), kind("other"), kind("opening_invoices"), kind("workers"), kind("placements")]);
    expect(out.map((k) => k.kind)).toEqual(["workers", "placements", "opening_invoices", "leave_balances", "other"]);
  });
  it("labels unavailable kinds with the owning epic", () => {
    expect(availableAfterText("16")).toBe("Available after Epic 16 ships");
    expect(availableAfterText("Epic 26")).toBe("Available after Epic 26 ships");
    expect(availableAfterText(null)).toBe("Not available yet");
  });
});

describe("go-live apply gating", () => {
  it("requires APPLY and skip_invalid when rows have errors", () => {
    expect(canApply(imp(), false, "APPLY")).toBe(false);
    expect(canApply(imp(), true, "apply")).toBe(false);
    expect(canApply(imp(), true, "APPLY")).toBe(true);
    expect(canApply(imp({ error_count: 0 }), false, "APPLY")).toBe(true);
  });
  it("never applies a non-previewed or empty import", () => {
    expect(canApply(imp({ status: "validating" }), true, "APPLY")).toBe(false);
    expect(canApply(imp({ valid_count: 0 }), true, "APPLY")).toBe(false);
    expect(canApply(null, true, "APPLY")).toBe(false);
  });
});

describe("go-live files and results", () => {
  it("links the error CSV report and the template", () => {
    expect(goLiveUrls.errorReport("i 1")).toBe("/api/v1/golive/imports/i%201/errors.csv");
    expect(goLiveUrls.template("workers")).toBe("/api/v1/golive/templates/workers");
  });
  it("accepts CSV files only", () => {
    expect(isCsvFile({ name: "workers.CSV", type: "" })).toBe(true);
    expect(isCsvFile({ name: "workers", type: "text/csv" })).toBe(true);
    expect(isCsvFile({ name: "workers.xlsx", type: "application/vnd.ms-excel" })).toBe(false);
    expect(isCsvFile(null)).toBe(false);
  });
  it("groups results by row status and accepts both row payload shapes", () => {
    expect(resultCounts(imp({ applied_count: 47, skipped_count: 3, failed_count: 0 })).map((c) => [c.status, c.count])).toEqual([
      ["applied", 47],
      ["skipped", 3],
      ["failed", 0],
    ]);
    expect(rowsOf([{ row_no: 1, status: "applied", errors: [], result_ref: "c-1" }])).toHaveLength(1);
    expect(rowDetail({ row_no: 2, status: "failed", errors: [{ row: 2, column: "email", code: "invalid", message: "Bad email" }], result_ref: null })).toBe("email: Bad email");
    expect(rowDetail({ row_no: 3, status: "applied", errors: [], result_ref: "cand-9" })).toBe("cand-9");
    expect(rowsOf(undefined)).toBeUndefined();
  });
});
