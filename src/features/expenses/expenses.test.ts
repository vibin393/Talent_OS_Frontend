import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  applySuggestion,
  buildDecideBody,
  buildLineIn,
  decideErrors,
  displayAmount,
  justificationError,
  justificationLineIds,
  linesMissingJustification,
  needsJustification,
  policyErrors,
  completeCategories,
  SUGGESTED_HINT,
  suggestionHint,
} from "./format";
import { currencyDigits, formatMoney, fromMinor, isValidAmountInput, normalizeDecimal, sumMoney, toMinor } from "./money";
import type { LinePreviewOut } from "./types";

const preview = (p: Partial<LinePreviewOut> = {}): LinePreviewOut => ({
  amount: "356.25",
  currency: "INR",
  km: "37.5",
  fx_rate: null,
  fx_rate_date: null,
  amount_claim_ccy: "356.25",
  claim_currency: "INR",
  billable: false,
  flags: [],
  receipt_required: false,
  justification_required: false,
  ...p,
});

describe("money strings", () => {
  it("formats 1026.57 INR without float drift", () => {
    expect(formatMoney("1026.57", "INR")).toBe("₹1,026.57");
    expect(formatMoney("356.25", "INR")).toBe("₹356.25");
    expect(formatMoney("2100", "INR")).toBe("₹2,100.00");
    expect(formatMoney("12345678.91", "INR")).toBe("₹1,23,45,678.91");
  });
  it("respects 0-decimal currencies and empty values", () => {
    expect(currencyDigits("JPY")).toBe(0);
    expect(formatMoney("1785", "JPY")).toContain("1,785");
    expect(formatMoney(null, "INR")).toBe("—");
  });
  it("sums decimal strings exactly (per-line rounded values)", () => {
    expect(sumMoney(["0.34", "0.34", "0.34"])).toBe("1.02");
    expect(sumMoney(["0.1", "0.2"])).toBe("0.30");
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumMoney(["1026.57", "356.25", "2100.00"])).toBe("3482.82");
    expect(sumMoney(["", null, "x", "1.5"])).toBe("1.50");
  });
  it("parses, rounds half-up and normalises", () => {
    expect(toMinor("1026.5747")).toBe(102657);
    expect(toMinor("0.835")).toBe(84);
    expect(toMinor("9.5000", 4)).toBe(95000);
    expect(fromMinor(-50)).toBe("-0.50");
    expect(fromMinor(1785, 0)).toBe("1785");
    expect(normalizeDecimal("9.5")).toBe("9.50");
    expect(isValidAmountInput("450.00")).toBe(true);
    for (const bad of ["", "1.234", "-1", "1e3", "1,000"]) expect(isValidAmountInput(bad)).toBe(false);
  });
});

describe("justification", () => {
  it("is required for flagged lines and previews", () => {
    expect(needsJustification({ flags: ["over_daily_limit"] })).toBe(true);
    expect(needsJustification({ flags: [] })).toBe(false);
    expect(needsJustification(preview({ justification_required: true }))).toBe(true);
    expect(justificationError(true, "  ")).toMatch(/required/i);
    expect(justificationError(true, "Client dinner")).toBeNull();
    expect(justificationError(false, "")).toBeNull();
  });
  it("lists flagged lines without justification and reads 422 line ids", () => {
    expect(
      linesMissingJustification([
        { id: "a", flags: ["receipt_missing"], justification: null },
        { id: "b", flags: ["over_claim_limit"], justification: "ok" },
        { id: "c", flags: [], justification: null },
      ]),
    ).toEqual(["a"]);
    const e = new ApiError(422, "justification_required", "x", { line_ids: ["l1", "l2"] });
    expect(justificationLineIds(e)).toEqual(["l1", "l2"]);
    expect(justificationLineIds(new Error("x"))).toEqual([]);
  });
});

describe("mileage", () => {
  it("displays the server preview amount, never the typed amount", () => {
    expect(displayAmount("mileage", "9999", "INR", preview())).toBe("₹356.25");
    expect(displayAmount("mileage", "9999", "INR", null)).toBe("—");
    expect(displayAmount("meals", "2100", "INR", preview())).toBe("₹2,100.00");
  });
  it("sends km and no amount for mileage lines", () => {
    const body = buildLineIn({
      expense_date: "2026-10-01",
      category: "mileage",
      description: "",
      amount: "500",
      currency: "USD",
      km: "37.5",
      receipt_file_id: null,
      billable: null,
      justification: "",
    });
    expect(body.amount).toBeNull();
    expect(body.currency).toBeNull();
    expect(body.km).toBe("37.5");
  });
});

describe("decisions", () => {
  it("requires a comment for each rejected line", () => {
    const body = buildDecideBody("approve", "", ["a", "b"], { b: { decision: "reject", comment: " " } });
    expect(body.line_decisions).toEqual([
      { line_id: "a", decision: "approve", comment: null },
      { line_id: "b", decision: "reject", comment: null },
    ]);
    expect(decideErrors(body)).toEqual({ b: expect.stringMatching(/required/i) });
    const ok = buildDecideBody("approve", "", ["a", "b"], { b: { decision: "reject", comment: "Personal expense" } });
    expect(decideErrors(ok)).toEqual({});
  });
  it("requires a comment for a whole-claim reject", () => {
    expect(decideErrors(buildDecideBody("reject", "", ["a"], {}))).toHaveProperty("claim");
    expect(decideErrors(buildDecideBody("reject", "Duplicate claim", ["a"], {}))).toEqual({});
  });
});

describe("AI receipt suggestions", () => {
  it("labels every prefilled field and drops malformed values", () => {
    const out = applySuggestion({ expense_date: "2026-10-01", merchant: "Uber", amount: "1,234.50", currency: "usd", category: "travel" });
    expect(out.values).toEqual({ expense_date: "2026-10-01", currency: "USD", category: "travel", description: "Uber" });
    expect(out.suggested).not.toContain("amount");
    expect(suggestionHint("currency", out.suggested)).toBe(SUGGESTED_HINT);
    expect(suggestionHint("amount", out.suggested)).toBeUndefined();
  });
  it("returns nothing for a failed read", () => {
    expect(applySuggestion(null)).toEqual({ values: {}, suggested: [] });
  });
});

describe("policy editor validation", () => {
  it("requires a mileage rate and markup % where relevant", () => {
    const cats = completeCategories([]);
    expect(cats).toHaveLength(6);
    const errs = policyErrors(cats.map((c) => (c.category === "meals" ? { ...c, rebill_method: "markup" as const, daily_limit: "abc" } : c)));
    expect(Object.keys(errs).sort()).toEqual(["meals.daily_limit", "meals.markup_pct", "mileage.mileage_rate_per_km"]);
  });
});
