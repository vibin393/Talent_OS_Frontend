import { describe, expect, it } from "vitest";
import {
  entitledModuleEntries,
  EXTERNAL_APP_ENTRIES,
  MARKETPLACE_ENTRY,
  MODULE_CATALOG,
  MODULE_ORDER,
} from "./catalog";
import { type ModuleKey } from "./modules";

describe("app-launcher catalog (Phase 2)", () => {
  const standard = new Set([
    "sales", "talent_acquisition", "vendor_mgmt", "workforce", "finance",
    "experience", "intelligence", "assessments", "surveys", "onboarding", "analytics",
  ]);

  it("has a catalog entry and a stable order slot for every module key", () => {
    const keys = Object.keys(MODULE_CATALOG) as ModuleKey[];
    for (const key of keys) {
      expect(MODULE_CATALOG[key].href).toMatch(/^\//);
      expect(MODULE_ORDER).toContain(key);
    }
    expect([...MODULE_ORDER].sort()).toEqual([...keys].sort());
  });

  it("shows only the entitled modules, in display order", () => {
    const entries = entitledModuleEntries(standard);
    const keys = entries.map((e) => e.key);
    // payroll, time_expense, ai_copilot are NOT in the standard plan.
    expect(keys).not.toContain("payroll");
    expect(keys).not.toContain("time_expense");
    expect(keys).not.toContain("ai_copilot");
    // Entitled ones are present and recruiting (talent_acquisition) comes before sales per MODULE_ORDER.
    expect(keys).toContain("talent_acquisition");
    expect(keys.indexOf("talent_acquisition")).toBeLessThan(keys.indexOf("sales"));
  });

  it("fails open when entitlements are not loaded (null) -> every module shown", () => {
    expect(entitledModuleEntries(null)).toHaveLength(MODULE_ORDER.length);
  });

  it("shows nothing for an empty plan", () => {
    expect(entitledModuleEntries(new Set())).toHaveLength(0);
  });

  it("always offers the embedded apps and the Marketplace regardless of plan", () => {
    expect(EXTERNAL_APP_ENTRIES.map((e) => e.key)).toEqual(["croar", "feedback-iq", "portal"]);
    for (const entry of EXTERNAL_APP_ENTRIES) {
      expect(entry.external).toBe(true);
      expect(entry.href).toMatch(/^\/apps\//);
    }
    expect(MARKETPLACE_ENTRY.href).toBe("/admin/integrations");
  });
});
