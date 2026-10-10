import { describe, expect, it } from "vitest";
import { formatMoney, formatPercent, formatTotals, formatWeighted, parseDecimal, startOfWeek } from "./format";

describe("weighted formatting from decimal strings", () => {
  it("parses decimal strings", () => {
    expect(parseDecimal("400000.00")).toBe(400000);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal(null)).toBeNull();
  });

  it("formats INR with Indian grouping and USD with western grouping", () => {
    expect(formatMoney("1250000.50", "INR")).toBe("₹12,50,000.5");
    expect(formatMoney("1250000", "USD")).toBe("$1,250,000");
    expect(formatMoney(null, "INR")).toBe("—");
  });

  it("formats probability and the weighted cell", () => {
    expect(formatPercent("40.00")).toBe("40%");
    expect(formatPercent("33.50")).toBe("33.5%");
    expect(formatWeighted("400000.00", "INR", "40.00")).toBe("₹4,00,000 (40%)");
  });

  it("formats one line per currency", () => {
    const lines = formatTotals(
      [
        { currency: "INR", estimated: "1000000.00", weighted: "400000.00" },
        { currency: "USD", estimated: "5000", weighted: "2500" },
      ],
      false,
    );
    expect(lines).toEqual(["₹10,00,000 · wtd ₹4,00,000", "$5,000 · wtd $2,500"]);
  });

  it("computes Monday as start of week", () => {
    expect(startOfWeek(new Date(2026, 9, 8))).toBe("2026-10-05");
    expect(startOfWeek(new Date(2026, 9, 11))).toBe("2026-10-05");
  });
});
