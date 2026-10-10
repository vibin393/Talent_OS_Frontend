import { describe, expect, it } from "vitest";
import { canExport } from "@/features/exports/use-export";
import { financeVisibleColumns } from "@/features/reports/query";
import { resultSections } from "@/features/search/global-search-state";
import { cellHref, cellText, hasLiveCells, marginColor, monthEnd } from "./executive-model";
import { formatMoney, formatPercent, groupIndian, parseDecimal } from "./money";
import { p2TileQuery, parseP2Params, withP2Params } from "./params";
import { breakdownData, p2Columns, tileBadges } from "./tile-model";
import type { ExecRow } from "./types";

const LE1 = "11111111-1111-4111-8111-111111111111";
const LE2 = "22222222-2222-4222-8222-222222222222";

describe("money formatting (Decimal strings, lakh grouping)", () => {
  it("groups in lakhs and crores", () => {
    expect(groupIndian("1234567")).toBe("12,34,567");
    expect(groupIndian("123456789")).toBe("12,34,56,789");
    expect(groupIndian("999")).toBe("999");
    expect(formatMoney({ amount: "1234567.5", currency: "INR" })).toBe("₹12,34,567.50");
  });

  it("never loses paise on large values and rounds half-up as strings", () => {
    expect(formatMoney({ amount: "98765432109876.55", currency: "INR" })).toBe("₹9,87,65,43,21,09,876.55");
    expect(parseDecimal("0.995")).toEqual({ negative: false, integer: "1", fraction: "00" });
    expect(parseDecimal("9.999")?.integer).toBe("10");
  });

  it("formats negatives with a minus or in parentheses", () => {
    expect(formatMoney({ amount: "-200.00", currency: "INR" })).toBe("-₹200.00");
    expect(formatMoney({ amount: "-200.00", currency: "INR" }, "parens")).toBe("(₹200.00)");
    expect(formatMoney({ amount: "-0.00", currency: "INR" })).toBe("₹0.00");
  });

  it("shows a dash for null margin %", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent("47.37")).toBe("47.37%");
    expect(formatMoney(null)).toBe("—");
  });
});

describe("legal entity filter URL sync", () => {
  it("parses, keeps valid ids only and round-trips", () => {
    const p = parseP2Params(new URLSearchParams(`le=${LE1}&le=bad&le=${LE2}&as_of=2026-10-31`));
    expect(p).toEqual({ legalEntityIds: [LE1, LE2], asOf: "2026-10-31" });
    const qs = withP2Params("view=finance", p);
    expect(new URLSearchParams(qs).getAll("le")).toEqual([LE1, LE2]);
    expect(new URLSearchParams(qs).get("view")).toBe("finance");
    expect(withP2Params(qs, { legalEntityIds: [], asOf: null })).toBe("view=finance");
  });

  it("adds legal_entity_ids and as_of to the tile query", () => {
    const q = new URLSearchParams(p2TileQuery("from=2026-10-01", { legalEntityIds: [LE1], asOf: "2026-10-31" }));
    expect(q.getAll("legal_entity_ids")).toEqual([LE1]);
    expect(q.get("as_of")).toBe("2026-10-31");
    expect(q.get("from")).toBe("2026-10-01");
  });
});

describe("executive grid", () => {
  const revenue: ExecRow = {
    key: "revenue",
    label: "Revenue",
    kind: "money",
    masked: false,
    cells: [
      { month: "2026-10-01", value: { amount: "-1500.00", currency: "INR" }, source: "summary" },
      { month: "2026-11-01", value: { amount: "2000.00", currency: "INR" }, source: "live" },
    ],
  };

  it("wraps negatives in parentheses and masks hidden rows", () => {
    expect(cellText(revenue, revenue.cells[0])).toBe("(₹1,500.00)");
    expect(cellText({ ...revenue, masked: true }, revenue.cells[1])).toBe("—");
    expect(cellText({ kind: "percent", masked: false }, { value: null })).toBe("—");
  });

  it("links cells to the month's drill-down", () => {
    expect(monthEnd("2026-02-01")).toBe("2026-02-28");
    expect(cellHref("revenue", "2026-10-01", LE1)).toBe(`/reports/invoices?legal_entity_ids=${LE1}&from=2026-10-01&to=2026-10-31`);
    expect(cellHref("overdue_ar", "2026-10-01", LE1)).toBe(`/receivables/aging?legal_entity_id=${LE1}&as_of=2026-10-31`);
    expect(cellHref("fill_rate", "2026-10-01", LE1)).toBeNull();
  });

  it("flags reconciling (live) cells and colours margin bands", () => {
    expect(hasLiveCells([revenue])).toBe(true);
    expect(hasLiveCells([{ ...revenue, cells: [revenue.cells[0]] }])).toBe(false);
    expect(marginColor("25.00")).toBe("success");
    expect(marginColor("12")).toBe("warning");
    expect(marginColor("3")).toBe("danger");
    expect(marginColor(null)).toBe("informative");
  });
});

describe("tile badges and models", () => {
  it("labels WIP as an estimate and live tiles as reconciling", () => {
    expect(tileBadges({ estimate: true, source: "summary" }).map((b) => b.label)).toEqual(["Estimate"]);
    expect(tileBadges({ estimate: false, source: "live" }).map((b) => b.label)).toEqual(["Reconciling"]);
    expect(tileBadges({ estimate: true, source: "live" })[0].tooltip).toBe("Approved, not yet invoiced");
  });

  it("detects money columns and keeps text labels on bars", () => {
    const cols = p2Columns([{ client: "Acme", revenue: { amount: "10.00", currency: "INR" }, margin_pct: "12.50", n: 3 }]);
    expect(cols.map((c) => c.kind)).toEqual(["text", "money", "percent", "number"]);
    const bars = breakdownData({ rows: [{ key: "not_due", label: "Not due", money: { amount: "1234567.00", currency: "INR" } }] });
    expect(bars[0]).toMatchObject({ label: "Not due", value: 1234567, display: "₹12,34,567.00" });
  });
});

describe("search exact pinning", () => {
  it("pins the exact invoice first and does not repeat it in its group", () => {
    const hit = { id: "a", type: "invoice" as const, title: "Invoice INV/26-27/0042", url: "/billing/invoices/a", exact: true };
    const sections = resultSections({
      exact: hit,
      groups: [
        { type: "candidate", items: [{ id: "c", type: "candidate", title: "Cara", url: "/candidates/c" }] },
        { type: "invoice", items: [hit] },
      ],
    });
    expect(sections[0].key).toBe("top");
    expect(sections[0].hits[0].exact).toBe(true);
    expect(sections.find((s) => s.key === "invoice")).toBeUndefined();
  });
});

describe("export gating", () => {
  it("needs report:export and the kind's read permission", () => {
    expect(canExport({ "report:export": "tenant", "billing:read": "tenant" }, "invoices")).toBe(true);
    expect(canExport({ "report:export": "tenant" }, "invoices")).toBe(false);
    expect(canExport({ "billing:read": "tenant" }, "invoices")).toBe(false);
  });

  it("hides money columns of finance lists without report:finance_export", () => {
    const cols = [
      { key: "number", type: "string" },
      { key: "total", type: "money" },
    ];
    expect(financeVisibleColumns("invoices", cols, false).map((c) => c.key)).toEqual(["number"]);
    expect(financeVisibleColumns("invoices", cols, true)).toHaveLength(2);
    expect(financeVisibleColumns("placements", cols, false)).toHaveLength(2);
  });
});
