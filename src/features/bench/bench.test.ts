import { describe, expect, it } from "vitest";
import { benchColumnIds, costText, formatDecimal, isMoney, optInErrors, parseLocations, pctText, releaseValid, sectionItems } from "./format";
import type { BenchMatchItem } from "./types";

describe("bench decimal formatting", () => {
  it("formats decimal strings exactly, without floats", () => {
    expect(formatDecimal("4545.45", "INR")).toBe("₹4,545.45");
    expect(formatDecimal("1234567.89", "INR")).toBe("₹12,34,567.89");
    expect(formatDecimal("1234567.89", "USD")).toBe("$1,234,567.89");
    expect(formatDecimal("0.10", "INR")).toBe("₹0.10");
    expect(formatDecimal("12345678901234567.01", "INR")).toBe("₹12,34,56,78,90,12,34,567.01");
    expect(formatDecimal(null, "INR")).toBe("—");
  });
  it("validates money input as a string", () => {
    expect(isMoney("4545.45")).toBe(true);
    expect(isMoney("4545.455")).toBe(false);
    expect(isMoney("-1")).toBe(false);
    expect(isMoney("abc")).toBe(false);
  });
  it("shows redeployment rate as a percentage", () => {
    expect(pctText("1.0000")).toBe("100.0 %");
    expect(pctText("0.6667")).toBe("66.6 %");
    expect(pctText(null)).toBe("—");
  });
});

describe("masked cost", () => {
  it("hides cost without compensation:view", () => {
    expect(costText("3500.00", "INR", true)).toBe("••••");
    expect(costText(null, "INR", false)).toBe("—");
    expect(costText("3500.00", "INR", false)).toBe("₹3,500.00");
    expect(benchColumnIds(false)).not.toContain("cost");
    expect(benchColumnIds(true)).toContain("cost");
  });
});

describe("release dialog", () => {
  it("requires a reason, and a note for other", () => {
    expect(releaseValid("", "")).toBe(false);
    expect(releaseValid("resigned", "")).toBe(true);
    expect(releaseValid("other", "  ")).toBe(false);
    expect(releaseValid("other", "Moved abroad")).toBe(true);
  });
});

describe("bench section ordering", () => {
  it("keeps the API order", () => {
    const items = [{ candidate: { id: "b" } }, { candidate: { id: "a" } }, { candidate: { id: "c" } }] as BenchMatchItem[];
    expect(sectionItems(items).map((i) => i.candidate.id)).toEqual(["b", "a", "c"]);
  });
});

describe("opt-in form", () => {
  it("validates the date and lists", () => {
    const ok = { available_from: "2026-10-10", work_authorization: null, preferred_locations: ["Pune"] };
    expect(optInErrors(ok, "2026-10-05")).toEqual({});
    expect(optInErrors({ ...ok, available_from: "" }, "2026-10-05").available_from).toBeTruthy();
    expect(optInErrors({ ...ok, available_from: "2026-10-01" }, "2026-10-05").available_from).toBeTruthy();
    expect(optInErrors({ ...ok, preferred_locations: Array(21).fill("x") }, "2026-10-05").preferred_locations).toBeTruthy();
    expect(parseLocations(" Pune, ,Chennai ")).toEqual(["Pune", "Chennai"]);
  });
});
