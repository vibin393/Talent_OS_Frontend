import { describe, expect, it } from "vitest";
import { blockerLabel, formatDecimalMoney, sumDecimals, VENDOR_TRANSITIONS } from "./format";
import { groupLines } from "./statement-lines";
import type { StatementLineOut } from "./types";

describe("Decimal money formatting (no floats)", () => {
  it("formats INR with lakh grouping and two places", () => {
    expect(formatDecimalMoney("20150", "INR")).toBe("₹20,150.00");
    expect(formatDecimalMoney("1234567.891", "INR")).toBe("₹12,34,567.89");
    expect(formatDecimalMoney("1350.0000", "INR")).toBe("₹1,350.00");
  });

  it("rounds half-up on the string and carries", () => {
    expect(formatDecimalMoney("0.005", "INR")).toBe("₹0.01");
    expect(formatDecimalMoney("999.995", "USD")).toBe("$1,000.00");
    expect(formatDecimalMoney("-12.5", "INR")).toBe("-₹12.50");
  });

  it("keeps precision a float would lose", () => {
    expect(formatDecimalMoney("90071992547409.93", "USD")).toBe("$90,071,992,547,409.93");
    expect(sumDecimals(["0.10", "0.20"])).toBe("0.30");
    expect(sumDecimals(["10400.00", "9750.00", "-150.00"])).toBe("20000.00");
  });

  it("handles empty values", () => {
    expect(formatDecimalMoney(null)).toBe("—");
  });
});

describe("statement lines", () => {
  const line = (worker: string, amount: string): StatementLineOut => ({
    id: `${worker}-${amount}`,
    line_kind: "time",
    source_kind: "timesheet_entry",
    source_id: "s",
    placement_id: null,
    worker_name_snapshot: worker,
    work_date: "2026-09-02",
    time_category: "regular",
    quantity: "8.00",
    vendor_rate: "1300.0000",
    multiplier: "1.0000",
    amount,
    currency: "INR",
  });

  it("groups by worker with exact subtotals", () => {
    const groups = groupLines([line("Asha", "10400.00"), line("Ravi", "0.10"), line("Asha", "9750.00"), line("Ravi", "0.20")]);
    expect(groups.map((g) => [g.worker, g.subtotal])).toEqual([
      ["Asha", "20150.00"],
      ["Ravi", "0.30"],
    ]);
  });
});

describe("vendor status machine copy", () => {
  it("mirrors the backend transitions", () => {
    expect(VENDOR_TRANSITIONS.onboarding).toEqual(["active"]);
    expect(VENDOR_TRANSITIONS.inactive).toEqual([]);
    expect(blockerLabel("document:registration")).toBe("Missing or expired registration document");
  });
});
