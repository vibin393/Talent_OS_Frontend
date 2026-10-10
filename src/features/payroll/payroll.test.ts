import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  canFinalize,
  canGeneratePreview,
  canMarkProcessed,
  displayHours,
  displayMoney,
  finalizeConfirmed,
  mappingErrors,
  moveColumn,
  payrollErrorMessage,
  STATUTORY_COLUMNS,
  statutoryCell,
  totalsLines,
} from "./format";
import type { CatalogueField, ExceptionsOut, VersionOut } from "./types";

const version = (v: Partial<VersionOut> = {}): VersionOut => ({
  id: "v1",
  human_id: "PEX-000001",
  pay_period_id: "p1",
  legal_entity_id: "le",
  kind: "preview",
  supplementary: false,
  seq: 1,
  status: "generated",
  based_on_preview_id: null,
  exclude_exceptions: false,
  generated_at: null,
  finalized_at: null,
  items_hash: null,
  content_hash: null,
  exceptions: {},
  totals: { INR: { gross_earnings_inputs: "10276.89", reimbursements_total: "1026.57", workers: "1" } },
  row_count: 1,
  item_count: 4,
  provider_status: "not_sent",
  provider_reference: null,
  processed_at: null,
  ...v,
});

const exceptions = (blocking: boolean): ExceptionsOut => ({
  pay_period_id: "p1",
  blocking,
  counts: { unapproved_timesheets: 0, missing_pay_rate: 0, missing_bank_details: blocking ? 1 : 0, currency_mismatch: 0 },
  unapproved_timesheets: [],
  missing_pay_rate: [],
  missing_bank_details: [],
  currency_mismatch: [],
});

describe("finalize confirmation gating", () => {
  it("requires the exact typed word", () => {
    expect(finalizeConfirmed("FINALIZE")).toBe(true);
    expect(finalizeConfirmed("  FINALIZE ")).toBe(true);
    expect(finalizeConfirmed("finalize")).toBe(false);
    expect(finalizeConfirmed("FINAL")).toBe(false);
  });
  it("only a generated, non-empty preview can be finalized; only finalized versions processed", () => {
    expect(canFinalize(version())).toBe(true);
    expect(canFinalize(version({ status: "superseded" }))).toBe(false);
    expect(canFinalize(version({ item_count: 0 }))).toBe(false);
    expect(canFinalize(version({ kind: "final", status: "finalized" }))).toBe(false);
    expect(canMarkProcessed(version({ kind: "final", status: "finalized" }))).toBe(true);
    expect(canMarkProcessed(version({ kind: "final", status: "processed" }))).toBe(false);
  });
  it("maps a stale preview to a regenerate hint", () => {
    expect(payrollErrorMessage(new ApiError(409, "preview_stale", "x"))).toMatch(/Regenerate/);
  });
});

describe("exception proceed checkbox", () => {
  it("blocks generation until 'proceed excluding' is ticked", () => {
    expect(canGeneratePreview(undefined, true)).toBe(false);
    expect(canGeneratePreview(exceptions(false), false)).toBe(true);
    expect(canGeneratePreview(exceptions(true), false)).toBe(false);
    expect(canGeneratePreview(exceptions(true), true)).toBe(true);
  });
});

describe("statutory columns", () => {
  it("are the seven placeholders and always render empty", () => {
    expect(STATUTORY_COLUMNS.map((c) => c.key)).toEqual([
      "pf_employee",
      "pf_employer",
      "esi_employee",
      "esi_employer",
      "professional_tax",
      "tds_salary",
      "other_deductions",
    ]);
    expect(statutoryCell()).toBe("");
  });
});

describe("decimal string display", () => {
  it("shows money and hours from strings without float drift", () => {
    expect(displayMoney("3425.63", "INR")).toBe("₹3,425.63");
    expect(displayMoney("-352.35", "INR")).toBe("-₹352.35");
    expect(displayHours("7.83")).toBe("7.83");
    expect(displayHours("0.00")).toBe("—");
    expect(totalsLines(version())[0]).toContain("₹10,276.89");
    expect(totalsLines(version())[0]).toContain("1 worker");
  });
});

describe("mapping editor validation", () => {
  const cat: CatalogueField[] = [
    { key: "worker_human_id", label: "Worker ID", identity: true, placeholder: false },
    { key: "hours_regular", label: "Regular hours", identity: false, placeholder: false },
    { key: "pf_employee", label: "PF (employee)", identity: false, placeholder: true },
  ];
  it("requires a name, known fields, unique headers and an identity column", () => {
    const ok = [
      { source_field: "worker_human_id", header: "Emp", include: true },
      { source_field: "pf_employee", header: "PF", include: true },
    ];
    expect(mappingErrors("Keka", ok, cat)).toEqual([]);
    expect(mappingErrors("", ok, cat)).toContain("Name the mapping.");
    expect(mappingErrors("K", [{ source_field: "hours_regular", header: "H", include: true }], cat)).toContain(
      "Include at least one identity column.",
    );
    expect(mappingErrors("K", [...ok, { source_field: "net_pay", header: "Net", include: true }], cat)[0]).toMatch(/Unknown/);
    expect(mappingErrors("K", [...ok, { source_field: "hours_regular", header: "emp", include: true }], cat)).toContain(
      "Column headers must be unique.",
    );
  });
  it("reorders columns within bounds", () => {
    const cols = cat.map((c) => ({ source_field: c.key, header: c.label, include: true }));
    expect(moveColumn(cols, 0, 1).map((c) => c.source_field)[0]).toBe("hours_regular");
    expect(moveColumn(cols, 0, -1)).toBe(cols);
  });
});
