import { describe, expect, it } from "vitest";
import {
  addDays,
  dayOfWeek,
  formatInZone,
  formatOffset,
  listTimeZones,
  localParts,
  offsetMinutes,
  toUtcPreview,
  zoneLabel,
} from "./zones";

describe("zones", () => {
  it("formats offsets", () => {
    expect(formatOffset(330)).toBe("UTC+05:30");
    expect(formatOffset(-240)).toBe("UTC-04:00");
    expect(formatOffset(0)).toBe("UTC+00:00");
  });

  it("computes offsets across DST", () => {
    expect(offsetMinutes("Asia/Kolkata", "2026-10-06T05:00:00Z")).toBe(330);
    expect(offsetMinutes("America/New_York", "2026-07-01T12:00:00Z")).toBe(-240);
    expect(offsetMinutes("America/New_York", "2026-01-15T12:00:00Z")).toBe(-300);
    expect(offsetMinutes("Europe/London", "2026-10-06T12:00:00Z")).toBe(60);
    expect(zoneLabel("Asia/Kolkata", "2026-10-06T05:00:00Z")).toBe("Asia/Kolkata (UTC+05:30)");
  });

  it("previews local times in UTC", () => {
    expect(toUtcPreview("2026-10-06", "10:30", "Asia/Kolkata")).toBe("2026-10-06T05:00:00.000Z");
    expect(toUtcPreview("2026-10-06", "10:30", "Europe/London")).toBe("2026-10-06T09:30:00.000Z");
    expect(toUtcPreview("2026-07-01", "09:00", "America/New_York")).toBe("2026-07-01T13:00:00.000Z");
    expect(toUtcPreview("2026-10-06", "10:30", "UTC")).toBe("2026-10-06T10:30:00.000Z");
  });

  it("returns null for a DST gap and malformed input", () => {
    expect(toUtcPreview("2026-03-08", "02:30", "America/New_York")).toBeNull();
    expect(toUtcPreview("2026-13-01", "10:00", "UTC")).toBeNull();
    expect(toUtcPreview("2026-10-06", "25:00", "UTC")).toBeNull();
    expect(toUtcPreview("2026-10-06", "10:00", "Not/AZone")).toBeNull();
  });

  it("uses the earlier instant for ambiguous times (fold=0)", () => {
    // 2026-11-01 01:30 happens twice in New York; the first is EDT (UTC-4).
    expect(toUtcPreview("2026-11-01", "01:30", "America/New_York")).toBe("2026-11-01T05:30:00.000Z");
  });

  it("formats instants in a zone", () => {
    const s = formatInZone("2026-10-06T05:00:00Z", "Asia/Kolkata");
    expect(s.startsWith("Tue 6 Oct, 10:30")).toBe(true);
    expect(s).toMatch(/IST|UTC\+05:30/);
    expect(formatInZone("2026-10-06T05:00:00Z", "UTC", { withZone: false })).toBe("Tue 6 Oct, 05:00");
    expect(localParts("2026-10-06T20:00:00Z", "Asia/Kolkata")).toMatchObject({ date: "2026-10-07", time: "01:30" });
  });

  it("puts preferred zones first without duplicates", () => {
    const zones = listTimeZones("Asia/Kolkata", "Asia/Kolkata", "bogus");
    expect(zones[0]).toBe("Asia/Kolkata");
    expect(zones.filter((z) => z === "Asia/Kolkata")).toHaveLength(1);
    expect(zones).toContain("UTC");
    expect(zones).not.toContain("bogus");
  });

  it("does calendar arithmetic", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(dayOfWeek("2026-10-05")).toBe(1);
  });
});
