// Entitlement-driven nav (Phase 2, Story 2.2). A module is shown only when the tenant's plan
// includes it — an orthogonal AND on top of the existing RBAC `requiresAny` permission gate.

/** Backend module keys (app/services/entitlements.py MODULES). */
export type ModuleKey =
  | "sales"
  | "talent_acquisition"
  | "vendor_mgmt"
  | "contracts"
  | "workforce"
  | "time_expense"
  | "finance"
  | "experience"
  | "intelligence"
  | "assessments"
  | "surveys"
  | "onboarding"
  | "analytics"
  | "payroll"
  | "ai_copilot";

/** Nav section `value` -> the plan module that gates it. Sections NOT listed here are CORE
 * (platform admin / always available) and are never hidden by entitlements. */
export const SECTION_MODULE: Record<string, ModuleKey> = {
  sales: "sales",
  recruiting: "talent_acquisition",
  campus: "talent_acquisition",
  referrals: "talent_acquisition",
  delivery: "workforce",
  compliance: "onboarding",
  time: "time_expense",
  finance: "finance",
  // integrations -> CORE (platform admin), not plan-gated
};

export const REPORTS_MODULE: ModuleKey = "analytics";
export const AI_MODULE: ModuleKey = "ai_copilot";

/** Entitled when the module is unmapped (core) OR the plan includes it.
 * `modules === null` means entitlements are still loading / errored -> fail OPEN (show everything);
 * the module's own API still enforces via `require_module`, so this is safe. */
export function isModuleEntitled(module: ModuleKey | undefined, modules: ReadonlySet<string> | null): boolean {
  if (module === undefined) return true; // core / unmapped
  if (modules === null) return true; // not loaded -> fail open
  return modules.has(module);
}

export function sectionEntitled(sectionValue: string, modules: ReadonlySet<string> | null): boolean {
  return isModuleEntitled(SECTION_MODULE[sectionValue], modules);
}
