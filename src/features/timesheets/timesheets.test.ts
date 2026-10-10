import { describe, expect, it } from "vitest";
import { configErrors } from "./config-validation";
import { formatDelta, formatHundredths, isValidHoursInput, normalizeHours, sumHours, toHundredths } from "./decimal";
import { bulkConfirmation, datesBetween, decisionError, splitDisplay } from "./format";
import { WORKER_ENTRY_FIELDS, WORKER_TIMESHEET_FIELDS, type ClientBulkPreviewOut, type ClientTimesheetSummary, type TimeConfigIn } from "./types";

describe("decimal hours input", () => {
  it("accepts 1-2 integer digits and up to 2 decimals", () => {
    for (const ok of ["", "0", "8", "7.5", "10.25", "24", "24.00", " 9 "]) expect(isValidHoursInput(ok)).toBe(true);
  });
  it("rejects malformed, over-precise, negative and > 24 values", () => {
    for (const bad of ["abc", "8.", ".5", "7.555", "-1", "100", "24.01", "25", "1e2", "8,5"]) expect(isValidHoursInput(bad)).toBe(false);
  });
});

describe("hundredths arithmetic", () => {
  it("sums without float drift: 0.1 + 0.2 = 0.30", () => {
    expect(sumHours(["0.1", "0.2"])).toBe("0.30");
    expect(0.1 + 0.2).not.toBe(0.3); // the reason we never parseFloat
  });
  it("sums a week (10.5 + 4 x 8)", () => {
    expect(sumHours(["10.5", "8", "8", "8.00", "8"])).toBe("42.50");
  });
  it("ignores empty / invalid values", () => {
    expect(sumHours(["", null, undefined, "x", "1.25"])).toBe("1.25");
  });
  it("parses and formats signed values", () => {
    expect(toHundredths("-1.5")).toBe(-150);
    expect(toHundredths("8.0000")).toBe(800);
    expect(formatHundredths(-100)).toBe("-1.00");
    expect(formatDelta("1.5")).toBe("+1.50");
    expect(formatDelta("-1")).toBe("-1.00");
    expect(normalizeHours("8")).toBe("8.00");
  });
});

describe("OT split display", () => {
  it("orders categories, drops zero rows and totals via hundredths", () => {
    const out = splitDisplay({
      days: [],
      totals: [
        { category: "ot", hours: "1.50" },
        { category: "double_time", hours: "0.00" },
        { category: "regular", hours: "41.00" },
      ],
    });
    expect(out.rows).toEqual([
      { label: "Regular", hours: "41.00" },
      { label: "Overtime", hours: "1.50" },
    ]);
    expect(out.total).toBe("42.50");
  });
});

describe("client decisions", () => {
  it("reject requires a comment", () => {
    expect(decisionError("reject", "")).toMatch(/required/i);
    expect(decisionError("reject", "   ")).toMatch(/required/i);
    expect(decisionError("reject", "Tuesday is wrong")).toBeNull();
  });
  it("approve does not require a comment", () => {
    expect(decisionError("approve", "")).toBeNull();
  });
});

describe("bulk approve confirmation", () => {
  const item = (id: string, hours: string): ClientTimesheetSummary => ({
    id,
    human_id: id,
    placement_id: "p",
    worker_name: "W",
    role_title: null,
    kind: "regular",
    period_start: "2026-09-28",
    period_end: "2026-10-04",
    status: "in_approval",
    total_hours: hours,
    totals: {},
    flags: { ot_above_threshold: false, holiday_entries: false, above_daily_cap: false },
    approval_request_id: null,
    awaiting_client: true,
    submitted_at: null,
  });
  it("cannot confirm before the preview arrives", () => {
    expect(bulkConfirmation(["a"], null).canConfirm).toBe(false);
  });
  it("only decides previewed, decidable ids and sums their hours exactly", () => {
    const preview: ClientBulkPreviewOut = {
      items: [item("a", "40.10"), item("b", "0.20"), item("c", "8.00")],
      not_decidable: ["c"],
      total_hours: "48.30",
      preview_hash: "h",
    };
    const c = bulkConfirmation(["a", "b", "c", "d"], preview);
    expect(c.decidableIds).toEqual(["a", "b"]);
    expect(c.skippedIds).toEqual(["c", "d"]);
    expect(c.totalHours).toBe("40.30");
    expect(c.canConfirm).toBe(true);
    expect(c.summary).toContain("Approve 2 timesheets");
    expect(c.summary).toContain("2 will be skipped");
  });
  it("blocks confirmation when nothing is decidable", () => {
    const c = bulkConfirmation(["c"], { items: [item("c", "8")], not_decidable: ["c"], total_hours: "0", preview_hash: "h" });
    expect(c.canConfirm).toBe(false);
  });
});

describe("Worker schema", () => {
  it("renders no rate, amount or margin fields", () => {
    const forbidden = /rate|amount|margin|bill|pay|cost|value|currency/i;
    expect([...WORKER_TIMESHEET_FIELDS, ...WORKER_ENTRY_FIELDS].filter((f) => forbidden.test(String(f)))).toEqual([]);
  });
});

describe("period dates and config validation", () => {
  it("lists period dates inclusively", () => {
    expect(datesBetween("2026-09-28", "2026-10-04")).toHaveLength(7);
    expect(datesBetween("2026-02-01", "2026-02-28")).toHaveLength(28);
  });
  it("validates thresholds and route refs", () => {
    const base: TimeConfigIn = {
      period_kind: "weekly",
      week_start: 0,
      entry_mode: "hours",
      hours_per_day: "8.00",
      work_days: [0, 1, 2, 3, 4],
      enabled_categories: ["regular", "ot"],
      ot_daily_threshold: "9",
      dt_daily_threshold: null,
      ot_weekly_threshold: null,
      pay_multipliers: { ot: "1.5" },
      bill_multipliers: {},
      daily_cap: "24.00",
      prefill_holidays: true,
      prefill_leave: true,
      holiday_calendar_id: null,
      approval_route: [{ kind: "placement_account_manager" }, { kind: "client_any" }, { kind: "finance_role", ref: null }],
    };
    expect(configErrors(base)).toEqual({});
    expect(Object.keys(configErrors({ ...base, dt_daily_threshold: "8" }))).toContain("dt_daily_threshold");
    expect(Object.keys(configErrors({ ...base, approval_route: [{ kind: "user" }] }))).toContain("route_0");
    expect(Object.keys(configErrors({ ...base, pay_multipliers: { ot: "x" } }))).toContain("multipliers");
  });
});
