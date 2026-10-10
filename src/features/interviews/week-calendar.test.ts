import { describe, expect, it } from "vitest";
import { layoutWeek, nextEventIndex, weekDays, weekStart } from "./week-layout";

describe("week calendar positioning", () => {
  it("finds the Monday of the week", () => {
    expect(weekStart("2026-10-08")).toBe("2026-10-05");
    expect(weekStart("2026-10-05")).toBe("2026-10-05");
    expect(weekStart("2026-10-11")).toBe("2026-10-05");
    expect(weekDays("2026-10-05")).toHaveLength(7);
  });

  it("positions an event in the viewer's time zone", () => {
    const ev = { id: "a", startsAt: "2026-10-06T05:00:00Z", endsAt: "2026-10-06T06:00:00Z" };
    const [ist] = layoutWeek([ev], "2026-10-05", "Asia/Kolkata");
    expect(ist).toMatchObject({ day: 1, top: 10 * 60 + 30, height: 60 });
    const [ny] = layoutWeek([ev], "2026-10-05", "America/New_York");
    expect(ny).toMatchObject({ day: 1, top: 60, height: 60 });
  });

  it("moves an event to another day across zones and drops events outside the week", () => {
    const late = { id: "b", startsAt: "2026-10-11T20:00:00Z", endsAt: "2026-10-11T21:00:00Z" };
    expect(layoutWeek([late], "2026-10-05", "UTC")[0]).toMatchObject({ day: 6, top: 20 * 60 });
    // In IST it is already Monday 12 Oct 01:30, i.e. next week.
    expect(layoutWeek([late], "2026-10-05", "Asia/Kolkata")).toHaveLength(0);
  });

  it("cuts events at midnight and enforces a minimum height", () => {
    const [p] = layoutWeek([{ id: "c", startsAt: "2026-10-06T23:30:00Z", endsAt: "2026-10-07T00:30:00Z" }], "2026-10-05", "UTC");
    expect(p).toMatchObject({ top: 23 * 60 + 30, height: 30 });
    const [q] = layoutWeek([{ id: "d", startsAt: "2026-10-06T10:00:00Z", endsAt: "2026-10-06T10:05:00Z" }], "2026-10-05", "UTC");
    expect(q.height).toBe(20);
  });

  it("puts overlapping events side by side", () => {
    const placed = layoutWeek(
      [
        { id: "a", startsAt: "2026-10-06T10:00:00Z", endsAt: "2026-10-06T11:00:00Z" },
        { id: "b", startsAt: "2026-10-06T10:30:00Z", endsAt: "2026-10-06T11:30:00Z" },
        { id: "c", startsAt: "2026-10-06T12:00:00Z", endsAt: "2026-10-06T13:00:00Z" },
      ],
      "2026-10-05",
      "UTC",
    );
    const byId = Object.fromEntries(placed.map((p) => [p.event.id, p]));
    expect(byId.a).toMatchObject({ lane: 0, lanes: 2 });
    expect(byId.b).toMatchObject({ lane: 1, lanes: 2 });
    expect(byId.c).toMatchObject({ lane: 0, lanes: 1 });
  });

  it("moves focus with arrow keys", () => {
    expect(nextEventIndex(3, 0, "ArrowRight")).toBe(1);
    expect(nextEventIndex(3, 2, "ArrowDown")).toBe(2);
    expect(nextEventIndex(3, 1, "ArrowLeft")).toBe(0);
    expect(nextEventIndex(3, 1, "End")).toBe(2);
    expect(nextEventIndex(0, 0, "ArrowRight")).toBe(-1);
  });
});
