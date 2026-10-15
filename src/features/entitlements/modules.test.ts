import { describe, expect, it } from "vitest";
import { AI_MODULE, isModuleEntitled, REPORTS_MODULE, SECTION_MODULE, sectionEntitled } from "./modules";

describe("entitlement-driven nav (Phase 2)", () => {
  const standard = new Set([
    "sales", "talent_acquisition", "vendor_mgmt", "workforce", "finance",
    "experience", "intelligence", "assessments", "surveys", "onboarding", "analytics",
  ]);

  it("hides a section whose module is not in the plan", () => {
    // "time" -> time_expense, which the standard plan does NOT include.
    expect(SECTION_MODULE.time).toBe("time_expense");
    expect(sectionEntitled("time", standard)).toBe(false);
    // "finance" -> finance, which standard DOES include.
    expect(sectionEntitled("finance", standard)).toBe(true);
    // "recruiting" -> talent_acquisition (included).
    expect(sectionEntitled("recruiting", standard)).toBe(true);
  });

  it("treats unmapped (core) sections as always entitled", () => {
    expect(SECTION_MODULE.integrations).toBeUndefined();
    expect(sectionEntitled("integrations", standard)).toBe(true);
    expect(sectionEntitled("integrations", new Set())).toBe(true);
  });

  it("gates the Reports and AI groups by their modules", () => {
    expect(isModuleEntitled(REPORTS_MODULE, standard)).toBe(true); // analytics in standard
    expect(isModuleEntitled(AI_MODULE, standard)).toBe(false); // ai_copilot not in standard
  });

  it("fails open when entitlements are not loaded (null)", () => {
    expect(sectionEntitled("time", null)).toBe(true);
    expect(isModuleEntitled(AI_MODULE, null)).toBe(true);
  });
});
