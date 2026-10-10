import { describe, expect, it } from "vitest";
import type { ClientLeaveCalendarOut } from "./types";
import { adjustmentErrors, clientCalendarCells, formatDays, halfDayError, monthDates, previewText } from "./validation";

describe("half-day form rules", () => {
  const base = { start_date: "2026-10-09", end_date: "2026-10-12", start_half: false, end_half: false, allow_half_day: true };
  it("accepts Fri pm to Mon am", () => {
    expect(halfDayError({ ...base, start_half: true, end_half: true })).toBeNull();
  });
  it("refuses both halves on a single day", () => {
    expect(halfDayError({ ...base, end_date: base.start_date, start_half: true, end_half: true })).toMatch(/both halves/);
  });
  it("refuses half days when the type does not allow them", () => {
    expect(halfDayError({ ...base, start_half: true, allow_half_day: false })).toMatch(/not allowed/);
  });
  it("refuses an end before the start and missing dates", () => {
    expect(halfDayError({ ...base, end_date: "2026-10-01" })).toMatch(/before/);
    expect(halfDayError({ ...base, end_date: "" })).toMatch(/Choose/);
  });
});

describe("preview day count rendering", () => {
  it("shows decimal strings as returned", () => {
    expect(formatDays("1.00")).toBe("1 day");
    expect(formatDays("1.50")).toBe("1.5 days");
    expect(formatDays("2.25")).toBe("2.25 days");
    expect(previewText("1.50", null)).toBe("1.5 days");
    expect(previewText("3.00", "balance_insufficient")).toMatch(/not enough balance/);
    expect(previewText("0.00", "no_working_days")).toMatch(/no working days/);
  });
});

describe("adjust balance validation", () => {
  it("accepts signed decimals with up to 2 places", () => {
    for (const ok of ["-1.5", "1.5", "2", "-0.25", "10.75"]) expect(adjustmentErrors(ok, "r").days).toBeUndefined();
  });
  it("refuses over-precise, malformed and zero values", () => {
    for (const bad of ["1.555", "abc", "1,5", "", "0", "-0.00", "1e2"]) expect(adjustmentErrors(bad, "r").days).toBeDefined();
  });
  it("requires a reason", () => {
    expect(adjustmentErrors("1", "  ").reason).toBeDefined();
  });
});

describe("client calendar", () => {
  it("shows On leave and never a leave type", () => {
    const data: ClientLeaveCalendarOut = {
      start: "2026-10-01",
      end: "2026-10-31",
      rows: [{ worker_name: "Wren", placement_id: "p", days: [{ date: "2026-10-09", half: "pm", label: "On leave" }] }],
    };
    const cells = clientCalendarCells(data);
    expect(cells).toEqual([{ worker: "Wren", date: "2026-10-09", text: "On leave (afternoon)" }]);
    expect(JSON.stringify(cells)).not.toMatch(/leave_type|Earned|reason|balance/);
  });
  it("builds month dates", () => {
    expect(monthDates("2028-02-01")).toHaveLength(29);
    expect(monthDates("2026-10-01")[30]).toBe("2026-10-31");
  });
});
