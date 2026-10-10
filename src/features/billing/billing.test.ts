import { describe, expect, it } from "vitest";
import { invoicesCsv } from "./invoices-view";
import {
  cancelCountdown,
  checkCreditLine,
  importSummary,
  irnAge,
  irnError,
  staleRows,
} from "./logic";
import { formatMoney, groupDigits, sumAmounts } from "./money";
import type { DocSummaryOut, EinvoiceImportOut, LineCap } from "./types";

describe("money formatting", () => {
  it("groups INR in lakh / crore and others in thousands, without floats", () => {
    expect(groupDigits("118000.00", "INR")).toBe("1,18,000.00");
    expect(groupDigits("12345678.5", "INR")).toBe("1,23,45,678.50");
    expect(groupDigits("1234567.50", "USD")).toBe("1,234,567.50");
    expect(formatMoney({ amount: "786.66", currency: "USD" })).toBe("$786.66");
    expect(formatMoney({ amount: "-0.35", currency: "INR" })).toBe("-₹0.35");
    expect(formatMoney({ amount: null, currency: "INR" })).toBe("—");
    expect(formatMoney({ amount: "100", currency: "AED" })).toBe("100.00 AED");
  });
  it("sums decimal strings exactly", () => {
    expect(sumAmounts(["0.10", "0.20", "1180.65"])).toBe("1180.95");
  });
});

const cap: LineCap = {
  line_id: "l1",
  line_no: 1,
  description: "Hours",
  effective_rate: "1851.8517",
  quantity: "7.25",
  original_taxable: "13425.92",
  remaining_taxable: "10.00",
  remaining_quantity: "7.25",
  components: [{ component: "cgst", original: "0.90", remaining: "0.90" }],
};

describe("note caps", () => {
  it("accepts an amount within the remaining taxable value and flags the exhausting credit", () => {
    expect(checkCreditLine(cap, { amount: "1.50" })).toMatchObject({
      ok: true,
      taxable: "1.50",
      exhausts: false,
    });
    expect(checkCreditLine(cap, { amount: "10.00" })).toMatchObject({
      ok: true,
      exhausts: true,
    });
  });
  it("refuses a credit beyond the cap or non-positive", () => {
    expect(checkCreditLine(cap, { amount: "10.01" }).ok).toBe(false);
    expect(checkCreditLine(cap, { amount: "0" }).ok).toBe(false);
    expect(checkCreditLine(cap, {}).message).toMatch(/quantity or an amount/);
  });
  it("prices a quantity with the effective rate (half-up)", () => {
    const big = { ...cap, remaining_taxable: "13425.92" };
    expect(checkCreditLine(big, { quantity: "7.25" })).toMatchObject({
      ok: true,
      taxable: "13425.92",
      exhausts: true,
    });
  });
});

describe("IRN validation", () => {
  it("needs 64 hex characters", () => {
    expect(irnError("a".repeat(64))).toBeNull();
    expect(irnError("A".repeat(64))).toBeNull();
    expect(irnError("a".repeat(63))).toMatch(/63 characters/);
    expect(irnError("g".repeat(64))).toMatch(/0-9 and a-f/);
    expect(irnError("")).toMatch(/required/);
  });
  it("counts pending age and the cancel window", () => {
    const now = new Date("2026-10-05T12:00:00Z");
    expect(irnAge("2026-10-04T10:00:00Z", now)).toEqual({
      hours: 26,
      warn: true,
    });
    expect(cancelCountdown("2026-10-05T13:30:00Z", now)).toEqual({
      open: true,
      text: "1 h 30 min left to cancel",
    });
    expect(cancelCountdown("2026-10-05T11:00:00Z", now).open).toBe(false);
  });
});

describe("stale diff and import preview", () => {
  it("renders the draft_stale diff rows", () => {
    expect(
      staleRows({
        document_total: { from: "1180.00", to: "1120.00" },
        fx_rate: { from: null, to: "83.25" },
      }),
    ).toEqual([
      { field: "Document total", from: "1180.00", to: "1120.00" },
      { field: "Exchange rate", from: "—", to: "83.25" },
    ]);
    expect(staleRows(null)).toEqual([]);
  });
  it("summarises import previews and only allows Apply with matched rows", () => {
    const base: EinvoiceImportOut = {
      batch_id: "b",
      status: "previewed",
      duplicate_of: null,
      counts: { matched: 2, unmatched: 1 },
      rows: [],
    };
    expect(importSummary(base)).toEqual({
      canApply: true,
      text: "2 matched, 1 unmatched",
      duplicate: false,
    });
    expect(
      importSummary({
        ...base,
        counts: { already_registered: 3 },
        duplicate_of: "x",
      }),
    ).toMatchObject({ canApply: false, duplicate: true });
    expect(importSummary(null).canApply).toBe(false);
  });
});

describe("issue confirm / CSV", () => {
  it("exports invoices as CSV with decimal strings", () => {
    const row = {
      number: "INV/26-27/0001",
      status: "issued",
      doc_date: "2026-10-05",
      due_date: null,
      client_name: "Acme, Inc",
      currency: "INR",
      taxable_total: "100.00",
      charged_tax_total: "18.00",
      document_total: "118.00",
      einvoice_status: "not_applicable",
      delivery_status: "sent",
    } as unknown as DocSummaryOut;
    expect(invoicesCsv([row]).split("\n")[1]).toBe(
      'INV/26-27/0001,issued,2026-10-05,,"Acme, Inc",INR,100.00,18.00,118.00,not_applicable,sent',
    );
  });
});
