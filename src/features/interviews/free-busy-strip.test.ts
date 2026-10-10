import { describe, expect, it } from "vitest";
import { busySlotIndexes, daySlots, hasConflict, proposedSlotIndexes, rowSummary, slotRanges, stripRange } from "./free-busy";

describe("free/busy strip slot mapping", () => {
  const slots = daySlots("2026-10-06", "Asia/Kolkata");

  it("builds 24 half-hour slots from 08:00 to 20:00 in the zone", () => {
    expect(slots).toHaveLength(24);
    expect(slots[0].label).toBe("08:00");
    expect(slots[23].label).toBe("19:30");
    expect(new Date(slots[0].startUtc!).toISOString()).toBe("2026-10-06T02:30:00.000Z");
    expect(stripRange(slots)).toEqual({ startUtc: "2026-10-06T02:30:00.000Z", endUtc: "2026-10-06T14:30:00.000Z" });
  });

  it("maps busy blocks onto overlapping slots", () => {
    // 10:00–11:00 IST = 04:30–05:30 UTC; 14:15–14:45 IST touches two slots.
    const busy = busySlotIndexes(
      [
        { start: "2026-10-06T04:30:00Z", end: "2026-10-06T05:30:00Z" },
        { start: "2026-10-06T08:45:00Z", end: "2026-10-06T09:15:00Z" },
      ],
      slots,
    );
    expect([...busy].sort((a, b) => a - b)).toEqual([4, 5, 12, 13]);
    expect(slotRanges(busy, slots)).toEqual(["10:00–11:00", "14:00–15:00"]);
    expect(rowSummary("Priya", "available", busy, slots)).toBe("Priya: busy 10:00–11:00, 14:00–15:00");
  });

  it("summarises free and unknown rows", () => {
    expect(rowSummary("Sam", "available", new Set(), slots)).toBe("Sam: free all day");
    expect(rowSummary("Ann", "unknown", new Set([1]), slots)).toBe("Ann: calendar not connected");
  });

  it("marks the proposed slot and detects conflicts", () => {
    const proposed = proposedSlotIndexes(10 * 60 + 30, 60, slots);
    expect([...proposed]).toEqual([5, 6]);
    expect(hasConflict(proposed, [new Set([4, 5])])).toBe(true);
    expect(hasConflict(proposed, [new Set([7])])).toBe(false);
    expect(proposedSlotIndexes(10 * 60 + 15, 30, slots).size).toBe(2);
  });

  it("leaves DST-gap slots without instants", () => {
    const gap = daySlots("2026-03-08", "America/New_York", 120, 240);
    expect(gap[0].startUtc).toBeNull();
    expect(gap[2].startUtc).not.toBeNull();
  });
});
