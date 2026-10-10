import { describe, expect, it } from "vitest";
import {
  applyFormErrors,
  canSubmitApply,
  dateToIso,
  eligibilityReasonLines,
  errorReasons,
  fitBadgeText,
  lastWorkingDayFor,
  matchSectionsOf,
  MOBILITY_STATUSES,
  mobilityErrorMessage,
  openingQuery,
  rulesFormErrors,
  rulesFromForm,
  sectionHeader,
  sortSections,
  statusLabel,
  transferFormErrors,
} from "./logic";
import type { MatchSection } from "./types";

describe("apply form", () => {
  it("requires the disclosure checkbox", () => {
    expect(applyFormErrors({ disclosureAck: false, coverNote: "" }).disclosureAck).toBeTruthy();
    expect(canSubmitApply({ disclosureAck: false, coverNote: "Keen" })).toBe(false);
    expect(canSubmitApply({ disclosureAck: true, coverNote: "" })).toBe(true);
  });

  it("limits the cover note", () => {
    expect(applyFormErrors({ disclosureAck: true, coverNote: "x".repeat(4001) }).coverNote).toBeTruthy();
  });
});

describe("eligibility reasons", () => {
  it("renders nothing for an eligible opening", () => {
    expect(eligibilityReasonLines(true, ["Minimum tenure 6 months"])).toEqual([]);
  });

  it("lists trimmed, de-duplicated reasons", () => {
    expect(eligibilityReasonLines(false, [" Minimum tenure 6 months ", "Minimum tenure 6 months", "", "Grade L3 required"])).toEqual([
      "Minimum tenure 6 months",
      "Grade L3 required",
    ]);
  });

  it("falls back to a generic line when no reason is given", () => {
    expect(eligibilityReasonLines(false, [])).toHaveLength(1);
  });

  it("reads 409 not_eligible reasons from error details", () => {
    expect(errorReasons({ details: { reasons: ["Too new", 3] } })).toEqual(["Too new"]);
    expect(errorReasons(null)).toEqual([]);
    expect(mobilityErrorMessage({ code: "not_eligible", message: "x" })).toMatch(/not eligible/);
    expect(mobilityErrorMessage({ code: "human_only_action", message: "x" })).toMatch(/person/);
  });
});

describe("last working day", () => {
  it("is the day before the effective date", () => {
    expect(lastWorkingDayFor("2027-03-01")).toBe("2027-02-28");
    expect(lastWorkingDayFor("2028-03-01")).toBe("2028-02-29");
    expect(lastWorkingDayFor("2027-01-01")).toBe("2026-12-31");
    expect(lastWorkingDayFor("2027-06-15")).toBe("2027-06-14");
  });

  it("rejects malformed input", () => {
    expect(lastWorkingDayFor("")).toBeNull();
    expect(lastWorkingDayFor("01/03/2027")).toBeNull();
  });

  it("formats a picker date by its local calendar day", () => {
    expect(dateToIso(new Date(2027, 2, 1))).toBe("2027-03-01");
    expect(dateToIso(null)).toBeNull();
  });
});

describe("matching sections", () => {
  const s = (key: string, label: string, order: number, total = 0): MatchSection<{ id: string }> => ({ key, label, order, total, items: [] });

  it("orders by order, then label", () => {
    const out = sortSections([s("ext", "External", 20), s("b", "Bench", 10), s("int", "Internal", 0), s("a", "Alumni", 10)]);
    expect(out.map((x) => x.key)).toEqual(["int", "a", "b", "ext"]);
  });

  it("formats the header with the total", () => {
    expect(sectionHeader({ label: "Internal", total: 3 })).toBe("Internal (3)");
  });

  it("reads optional sections from the list response", () => {
    expect(matchSectionsOf({ items: [] })).toEqual([]);
    expect(matchSectionsOf({ sections: null })).toEqual([]);
    expect(matchSectionsOf({ sections: [s("x", "X", 2), s("i", "Internal", 1)] }).map((x) => x.key)).toEqual(["i", "x"]);
  });
});

describe("labels and queries", () => {
  it("has a label for every status", () => {
    for (const st of MOBILITY_STATUSES) expect(statusLabel(st)).not.toMatch(/_/);
    expect(statusLabel("manager_approval")).toBe("Waiting for manager approval");
  });

  it("formats the fit badge", () => {
    expect(fitBadgeText(82)).toBe("Fit 82%");
    expect(fitBadgeText(null)).toBe("Not scored yet");
  });

  it("builds the board query", () => {
    expect(openingQuery({ q: " java ", location: "", includeIneligible: true, page: 2, pageSize: 20 })).toBe(
      "?q=java&include_ineligible=true&page=2&page_size=20",
    );
  });

  it("validates and converts the rules form", () => {
    expect(rulesFormErrors({ minTenure: "-1", grades: "", locations: "", note: "" }).minTenure).toBeTruthy();
    expect(rulesFromForm({ minTenure: "6", grades: "L3, L4,L3", locations: "", note: " " })).toEqual({
      min_tenure_months: 6,
      grades: ["L3", "L4"],
      locations: null,
      business_unit_ids: null,
      note: null,
    });
  });

  it("enforces the earliest effective date", () => {
    const ctx = { earliest_effective_date: "2027-03-01", employee_kind: "worker" as const };
    const base = { roleTitle: "", teamId: "", note: "", currency: "INR", rateUnit: "", payRate: "", billRate: "", burdenPct: "" };
    expect(transferFormErrors({ ...base, effectiveDate: "2027-02-28" }, ctx).effectiveDate).toBeTruthy();
    expect(transferFormErrors({ ...base, effectiveDate: "2027-03-01" }, ctx)).toEqual({});
    expect(transferFormErrors({ ...base, effectiveDate: "2027-03-01", burdenPct: "120" }, ctx).burdenPct).toBeTruthy();
  });
});
