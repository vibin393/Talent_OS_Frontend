import { describe, expect, it } from "vitest";
import {
  addAmounts,
  allocationState,
  autoAllocate,
  bucketLabel,
  canSubmitPayment,
  closeGate,
  expectedTds,
  fromMinor,
  type AllocationLine,
  toMinor,
  validatePtp,
} from "./logic";
import type { CheckResultOut } from "./types";

const line = (id: string, open: string, due: string, extra: Partial<AllocationLine> = {}): AllocationLine => ({
  document_id: id,
  document_kind: "invoice",
  number: id,
  due_date: due,
  open,
  disputed: "0.00",
  amount: "",
  tds: "",
  ...extra,
});

describe("decimal-string money (no floats)", () => {
  it("converts to and from minor units exactly", () => {
    expect(toMinor("0.1")).toBe(BigInt(10));
    expect(toMinor("118000")).toBe(BigInt(11800000));
    expect(toMinor("1.234")).toBeNull();
    expect(toMinor("abc")).toBeNull();
    expect(fromMinor(BigInt(-5))).toBe("-0.05");
    // 0.1 + 0.2 is exact
    expect(addAmounts(["0.10", "0.20"])).toBe("0.30");
  });

  it("computes expected TDS with half-up rounding on the taxable base", () => {
    expect(expectedTds("100000.00", "2")).toBe("2000.00");
    expect(expectedTds("50000.00", "2")).toBe("1000.00");
    expect(expectedTds("333.33", "2")).toBe("6.67");
    expect(expectedTds("100.00", "1.5")).toBe("1.50");
  });
});

describe("allocation grid", () => {
  it("auto-allocates oldest due first and never into disputed amounts", () => {
    const lines = [
      line("B", "500.00", "2026-09-30"),
      line("A", "300.00", "2026-08-31", { disputed: "100.00" }),
    ];
    const out = autoAllocate(lines, "450.00");
    expect(out.find((l) => l.document_id === "A")?.amount).toBe("200.00");
    expect(out.find((l) => l.document_id === "B")?.amount).toBe("250.00");
  });

  it("reserves the TDS on a line before cash", () => {
    const out = autoAllocate([line("A", "118000.00", "2026-09-30", { tds: "2000.00" })], "200000.00");
    expect(out[0].amount).toBe("116000.00");
  });

  it("tracks remaining and flags over-allocation", () => {
    const lines = [line("A", "100.00", "2026-01-01", { amount: "60.00" }), line("B", "100.00", "2026-01-02", { amount: "50.00" })];
    const st = allocationState(lines, "100.00");
    expect(st.allocated).toBe("110.00");
    expect(st.remaining).toBe("-10.00");
    expect(st.overAllocated).toBe(true);
    expect(canSubmitPayment(st, "100.00")).toBe(false);
    const ok = allocationState(lines, "150.00");
    expect(ok.remaining).toBe("40.00");
    expect(canSubmitPayment(ok, "150.00")).toBe(true);
  });

  it("flags a line exceeding its open balance (TDS included) and invalid input", () => {
    const st = allocationState(
      [line("A", "1000.00", "2026-01-01", { amount: "999.00", tds: "2.00" }), line("B", "10.00", "2026-01-01", { amount: "1.234" })],
      "5000.00",
    );
    expect(st.exceedsOpen).toEqual(["A"]);
    expect(st.invalid).toEqual(["B"]);
  });
});

describe("aging rendering helpers", () => {
  it("labels the as-of buckets", () => {
    expect(bucketLabel("not_due")).toBe("Not due");
    expect(bucketLabel("1-30")).toBe("1-30 days");
    expect(bucketLabel("91+")).toBe("91+ days");
  });
});

describe("close checklist gating", () => {
  const checks: CheckResultOut[] = [
    { name: "billing.pending_irn_in_period", label: "IRN", severity: "blocker", count: 0, link_path: null },
    { name: "receivables.unallocated_payments", label: "Unallocated", severity: "warning", count: 2, link_path: null },
    { name: "time.unapproved", label: "Timesheets", severity: "warning", count: 0, link_path: null },
  ];

  it("needs every warning with items acknowledged", () => {
    expect(closeGate(checks, new Set()).canClose).toBe(false);
    expect(closeGate(checks, new Set()).unacknowledged).toEqual(["receivables.unallocated_payments"]);
    expect(closeGate(checks, new Set(["receivables.unallocated_payments"])).canClose).toBe(true);
  });

  it("refuses while a blocker has items", () => {
    const blocked = checks.map((c) => (c.severity === "blocker" ? { ...c, count: 1 } : c));
    const gate = closeGate(blocked, new Set(["receivables.unallocated_payments"]));
    expect(gate.canClose).toBe(false);
    expect(gate.blockers).toEqual(["billing.pending_irn_in_period"]);
  });
});

describe("promise-to-pay validation", () => {
  it("requires a positive amount and a date not in the past", () => {
    expect(validatePtp({ kind: "call", ptp_amount: "", ptp_date: "" }, "2026-10-05")).toEqual({});
    const errs = validatePtp({ kind: "promise_to_pay", ptp_amount: "0", ptp_date: "2026-10-01" }, "2026-10-05");
    expect(Object.keys(errs).sort()).toEqual(["ptp_amount", "ptp_date"]);
    expect(validatePtp({ kind: "promise_to_pay", ptp_amount: "5000.50", ptp_date: "2026-10-20" }, "2026-10-05")).toEqual({});
    expect(validatePtp({ kind: "promise_to_pay", ptp_amount: "12.345", ptp_date: "2026-10-20" }, "2026-10-05").ptp_amount).toBeTruthy();
  });
});
