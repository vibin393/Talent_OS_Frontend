import { describe, expect, it } from "vitest";
import { CLIENT_NAV } from "@/app/client/nav-items";
import {
  BLANK_FORECAST_LINE,
  changedDiffLines,
  copyPeriodEnd,
  copyShiftMonth,
  diffRows,
  displayMoney,
  formatDiffValue,
  type ForecastForm,
  latestPredictedFill,
  monthOffset,
  normaliseMoney,
  planActions,
  shiftMonth,
  validateForecast,
  varianceTone,
} from "./logic";
import type { DiffLine } from "./types";

describe("month shift on copy", () => {
  it("shifts YYYY-MM across years", () => {
    expect(shiftMonth("2026-11", 3)).toBe("2027-02");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-04", 12)).toBe("2027-04");
  });
  it("uses the offset between the plan starts", () => {
    expect(monthOffset("2026-04-01", "2027-04-01")).toBe(12);
    expect(monthOffset("2026-04-15", "2026-07-01")).toBe(3);
    expect(copyShiftMonth("2026-09", "2026-04-01", "2027-04-01")).toBe("2027-09");
    expect(copyShiftMonth("2027-03", "2026-04-01", "2026-10-01")).toBe("2027-09");
  });
  it("previews the copied period end, clamping the day", () => {
    expect(copyPeriodEnd("2026-04-01", "2027-03-31", "2027-04-01")).toBe("2028-03-31");
    expect(copyPeriodEnd("2026-01-01", "2026-01-31", "2026-02-01")).toBe("2026-02-28");
  });
  it("rejects a malformed month", () => {
    expect(() => shiftMonth("2026-13", 1)).toThrow();
  });
});

describe("Decimal money input", () => {
  it("normalises to a 2-dp string", () => {
    expect(normaliseMoney("1200")).toEqual({ ok: true, value: "1200.00" });
    expect(normaliseMoney("1,200.5")).toEqual({ ok: true, value: "1200.50" });
    expect(normaliseMoney(" 007.25 ")).toEqual({ ok: true, value: "7.25" });
    expect(normaliseMoney(".5")).toEqual({ ok: true, value: "0.50" });
    expect(normaliseMoney("")).toEqual({ ok: true, value: null });
  });
  it("keeps precision a float would lose", () => {
    expect(normaliseMoney("9999999999999999.99")).toEqual({ ok: true, value: "9999999999999999.99" });
    expect(normaliseMoney("0.10")).toEqual({ ok: true, value: "0.10" });
  });
  it("rejects non-numeric, negative, >2 dp and huge values", () => {
    expect(normaliseMoney("12a").ok).toBe(false);
    expect(normaliseMoney("1e5").ok).toBe(false);
    expect(normaliseMoney("-5").ok).toBe(false);
    expect(normaliseMoney("1.234").ok).toBe(false);
    expect(normaliseMoney(".").ok).toBe(false);
    expect(normaliseMoney("12345678901234567").ok).toBe(false);
  });
  it("returns a string, never a number", () => {
    const r = normaliseMoney("100");
    expect(r.ok && typeof r.value).toBe("string");
  });
});

describe("masked money display", () => {
  it("shows an em dash for masked (null) money", () => {
    expect(displayMoney(null, "INR")).toBe("—");
    expect(displayMoney(undefined, "INR")).toBe("—");
    expect(displayMoney("1500.00", "INR")).toContain("1,500.00");
  });
  it("variance tone", () => {
    expect(varianceTone("-10.00")).toBe("danger");
    expect(varianceTone("25.00")).toBe("success");
    expect(varianceTone("0.00")).toBe("neutral");
    expect(varianceTone(null)).toBe("neutral");
  });
});

describe("revision diff rendering", () => {
  const modified: DiffLine = {
    lineage_id: "l1",
    line_id: "x1",
    change_kind: "modified",
    role_title: "Java dev",
    before: { headcount: 5, budget_amount: "1000.00", skills: [{ skill_key: "global:1", name: "Java", min_proficiency: 3 }] },
    after: { headcount: 7, budget_amount: "1400.00", skills: [{ skill_key: "global:1", name: "Java", min_proficiency: 4 }] },
    changed_fields: ["headcount", "budget_amount", "skills"],
  };
  it("lists only changed fields, before -> after", () => {
    const rows = diffRows(modified, "INR");
    expect(rows.map((r) => r.field)).toEqual(["headcount", "budget_amount", "skills"]);
    expect(rows[0]).toMatchObject({ label: "Headcount", before: "5", after: "7" });
    expect(rows[1].before).toContain("1,000.00");
    expect(rows[2]).toMatchObject({ before: "Java (3)", after: "Java (4)" });
  });
  it("masks money in a diff", () => {
    const masked: DiffLine = { ...modified, before: { budget_amount: null }, after: { budget_amount: null }, changed_fields: ["budget_amount"] };
    expect(diffRows(masked)[0]).toMatchObject({ before: "—", after: "—" });
  });
  it("shows added / removed lines against an em dash and drops unchanged lines", () => {
    const added: DiffLine = { ...modified, lineage_id: "l2", change_kind: "added", before: null, after: { role_title: "QA", headcount: 2 }, changed_fields: [] };
    const removed: DiffLine = { ...modified, lineage_id: "l3", change_kind: "removed", before: { role_title: "Ops", headcount: 1 }, after: null, changed_fields: [] };
    const unchanged: DiffLine = { ...modified, lineage_id: "l4", change_kind: "unchanged", changed_fields: [] };
    expect(diffRows(added)).toEqual([
      { field: "role_title", label: "Role", before: "—", after: "QA" },
      { field: "headcount", label: "Headcount", before: "—", after: "2" },
    ]);
    expect(diffRows(removed)[1]).toMatchObject({ before: "1", after: "—" });
    expect(changedDiffLines([modified, added, unchanged]).map((l) => l.lineage_id)).toEqual(["l1", "l2"]);
  });
  it("formats months and enums", () => {
    expect(formatDiffValue("start_month", "2026-10")).toBe("Oct 2026");
    expect(formatDiffValue("line_type", "replacement")).toBe("Replacement");
    expect(formatDiffValue("notes", null)).toBe("—");
  });
});

describe("client forecast form validation", () => {
  const ok: ForecastForm = {
    name: " FY 27 ",
    period_start: "2027-04-01",
    period_end: "2028-03-31",
    lines: [{ ...BLANK_FORECAST_LINE, role_title: "Java dev", skills: "Java, Spring; java", headcount: "3", planned_start_month: "2027-05" }],
  };
  it("builds the request body without money", () => {
    const { errors, body } = validateForecast(ok);
    expect(errors).toEqual({});
    expect(body).toEqual({
      name: "FY 27",
      period_start: "2027-04-01",
      period_end: "2028-03-31",
      lines: [{ role_title: "Java dev", skills: [{ name: "Java" }, { name: "Spring" }], headcount: 3, location_text: null, planned_start_month: "2027-05", notes: null }],
    });
    expect(JSON.stringify(body)).not.toMatch(/budget|rate/);
  });
  it("requires a name, ordered period and at least one line", () => {
    const { errors, body } = validateForecast({ ...ok, name: " ", period_end: "2027-04-01", lines: [] });
    expect(body).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(["lines", "name", "period_end"]);
  });
  it("checks headcount 1..500 and the month format", () => {
    const line = ok.lines[0];
    const bad = (patch: Partial<typeof line>) => validateForecast({ ...ok, lines: [{ ...line, ...patch }] }).errors;
    expect(bad({ headcount: "0" })["lines.0.headcount"]).toBeTruthy();
    expect(bad({ headcount: "501" })["lines.0.headcount"]).toBeTruthy();
    expect(bad({ headcount: "2.5" })["lines.0.headcount"]).toBeTruthy();
    expect(bad({ headcount: "500" })["lines.0.headcount"]).toBeUndefined();
    expect(bad({ planned_start_month: "2027-5" })["lines.0.planned_start_month"]).toBeTruthy();
    expect(bad({ planned_start_month: "2027-13" })["lines.0.planned_start_month"]).toBeTruthy();
    expect(bad({ role_title: "" })["lines.0.role_title"]).toBeTruthy();
  });
});

describe("lifecycle actions", () => {
  it("offers the transitions of each status", () => {
    expect(planActions("draft", true).map((a) => a.action)).toEqual(["budget"]);
    expect(planActions("budgeted", true).map((a) => a.action)).toEqual(["submit", "unbudget"]);
    expect(planActions("approved", true).map((a) => a.action)).toEqual(["start-revision"]);
    expect(planActions("revision_draft", true).map((a) => a.action)).toEqual(["submit", "discard-revision"]);
    expect(planActions("rejected", true).map((a) => a.action)).toEqual(["reopen"]);
    expect(planActions("pending_approval", true)).toEqual([]);
    expect(planActions("draft", false)).toEqual([]);
  });
});

describe("predicted fill date", () => {
  const today = new Date("2026-10-07T10:00:00Z");
  it("takes the latest prediction", () => {
    expect(latestPredictedFill(["10", null, "30.4"], today)).toBe("2026-11-07");
  });
  it("is null without predictions", () => {
    expect(latestPredictedFill([], today)).toBeNull();
    expect(latestPredictedFill([null, undefined], today)).toBeNull();
  });
});

describe("nav entries gated by permissions", () => {
  it("shows Workforce only with workforce_plan:read", async () => {
    const { NAV_ITEMS, visibleNavItems } = await import("@/components/app-shell/nav-items");
    const hrefs = (p: Record<string, string>) => visibleNavItems(NAV_ITEMS, p).map((i) => i.href);
    expect(NAV_ITEMS.find((n) => n.href === "/workforce")?.requiresAny).toEqual(["workforce_plan:read"]);
    expect(hrefs({ "project:read": "tenant" })).not.toContain("/workforce");
    expect(hrefs({ "workforce_plan:read": "tenant" })).toContain("/workforce");
  }, 120_000);
  it("shows client Forecasts only with forecasts:submit", () => {
    const visible = (perms: string[]) => CLIENT_NAV.filter((n) => !n.adminOnly && (!n.permission || perms.includes(n.permission))).map((n) => n.href);
    expect(CLIENT_NAV.find((n) => n.href === "/client/forecasts")?.permission).toBe("forecasts:submit");
    expect(visible(["projects:view"])).not.toContain("/client/forecasts");
    expect(visible(["forecasts:submit"])).toContain("/client/forecasts");
  });
});
