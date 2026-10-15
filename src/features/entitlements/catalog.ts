// App-launcher catalog (Phase 2, Stories 2.1/2.2). Maps the tenant's entitled plan modules — and the
// embedded external platform apps — to the waffle launcher entries. The launcher shows the dashboard
// first, then only the modules the plan includes, then the external apps, then the Marketplace.
//
// This is the DISPLAY/landing-route source of truth for modules; `modules.ts` stays the source of truth
// for nav-section gating. Both read the same `ModuleKey`s and the same `isModuleEntitled` predicate.

import {
  type FluentIcon,
  BotSparkle20Regular,
  BrainCircuit20Regular,
  Briefcase20Regular,
  BuildingPeople20Regular,
  CalendarClock20Regular,
  CheckmarkCircle20Regular,
  ClipboardTask20Regular,
  DataBarVertical20Regular,
  DocumentText20Regular,
  GridDots20Regular,
  Heart20Regular,
  Organization20Regular,
  Poll20Regular,
  PuzzlePiece20Regular,
  ReceiptMoney20Regular,
  Sparkle20Regular,
  Target20Regular,
} from "@fluentui/react-icons";
import { DEFAULT_APP_PATH } from "@/lib/navigation";
import { EMBEDDED_APPS } from "@/features/module-host/apps";
import { isModuleEntitled, type ModuleKey } from "./modules";

export type LauncherEntry = {
  key: string;
  label: string;
  icon: FluentIcon;
  /** Landing route (an in-app path, or a `/apps/*` module-host route for an embedded app). */
  href: string;
  /** True for an embedded external app or the Marketplace (not a first-party in-app module). */
  external?: boolean;
};

/** Each plan module -> its landing route in THIS app. `surveys`/`experience` land on embedded apps. */
export const MODULE_CATALOG: Record<ModuleKey, LauncherEntry> = {
  sales: { key: "sales", label: "Sales", icon: Target20Regular, href: "/sales" },
  talent_acquisition: { key: "talent_acquisition", label: "Recruiting", icon: Briefcase20Regular, href: "/demands" },
  vendor_mgmt: { key: "vendor_mgmt", label: "Vendors", icon: BuildingPeople20Regular, href: "/vendors" },
  contracts: { key: "contracts", label: "Contracts", icon: DocumentText20Regular, href: "/contracts" },
  workforce: { key: "workforce", label: "Workforce", icon: Organization20Regular, href: "/workforce" },
  time_expense: { key: "time_expense", label: "Time & expense", icon: CalendarClock20Regular, href: "/timesheets" },
  finance: { key: "finance", label: "Finance", icon: ReceiptMoney20Regular, href: "/billing/invoices" },
  // Employee experience runs in the embedded Croar app.
  experience: { key: "experience", label: "Experience", icon: Heart20Regular, href: "/apps/croar", external: true },
  intelligence: { key: "intelligence", label: "Intelligence", icon: BrainCircuit20Regular, href: "/reports/skills" },
  assessments: { key: "assessments", label: "Assessments", icon: ClipboardTask20Regular, href: "/assessments" },
  // Surveys run in the embedded Feedback IQ app.
  surveys: { key: "surveys", label: "Surveys", icon: Poll20Regular, href: "/apps/feedback-iq", external: true },
  onboarding: { key: "onboarding", label: "Onboarding", icon: CheckmarkCircle20Regular, href: "/onboarding" },
  analytics: { key: "analytics", label: "Analytics", icon: DataBarVertical20Regular, href: "/reports" },
  payroll: { key: "payroll", label: "Payroll", icon: ReceiptMoney20Regular, href: "/payroll" },
  ai_copilot: { key: "ai_copilot", label: "AI Copilot", icon: BotSparkle20Regular, href: "/ai/copilot" },
};

/** Launcher display order for the module entries. */
export const MODULE_ORDER: readonly ModuleKey[] = [
  "talent_acquisition",
  "sales",
  "vendor_mgmt",
  "contracts",
  "workforce",
  "time_expense",
  "finance",
  "payroll",
  "onboarding",
  "assessments",
  "surveys",
  "experience",
  "intelligence",
  "analytics",
  "ai_copilot",
];

/** The suite home (dashboard), always the first launcher entry. */
export const HOME_ENTRY: LauncherEntry = { key: "home", label: "Talent OS", icon: GridDots20Regular, href: DEFAULT_APP_PATH };

/** Marketplace (Story 5.2): integrations / add-on modules. Links to the existing admin integrations area. */
export const MARKETPLACE_ENTRY: LauncherEntry = {
  key: "marketplace",
  label: "Marketplace",
  icon: PuzzlePiece20Regular,
  href: "/admin/integrations",
  external: true,
};

/** Icons for the embedded platform apps, keyed by their registry key. */
const EXTERNAL_APP_ICONS: Record<string, FluentIcon> = {
  croar: Sparkle20Regular,
  "feedback-iq": Poll20Regular,
  portal: Briefcase20Regular,
};

/** The embedded external apps as launcher entries (always shown — they are part of the platform). */
export const EXTERNAL_APP_ENTRIES: readonly LauncherEntry[] = EMBEDDED_APPS.map((app) => ({
  key: app.key,
  label: app.label,
  icon: EXTERNAL_APP_ICONS[app.key] ?? GridDots20Regular,
  href: app.route,
  external: true,
}));

/**
 * The entitled first-party module entries, in display order. `modules === null` (loading/errored)
 * fails OPEN and returns every module, mirroring `isModuleEntitled`.
 */
export function entitledModuleEntries(modules: ReadonlySet<string> | null): LauncherEntry[] {
  return MODULE_ORDER.filter((key) => isModuleEntitled(key, modules)).map((key) => MODULE_CATALOG[key]);
}
