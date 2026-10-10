import {
  Briefcase20Filled,
  Briefcase20Regular,
  Building20Filled,
  Building20Regular,
  bundleIcon,
  BuildingPeople20Filled,
  BuildingPeople20Regular,
  CalendarLtr20Filled,
  CalendarLtr20Regular,
  CheckmarkCircle20Filled,
  CheckmarkCircle20Regular,
  DataBarVertical20Filled,
  DataBarVertical20Regular,
  DocumentSignature20Filled,
  DocumentSignature20Regular,
  DocumentText20Filled,
  DocumentText20Regular,
  Receipt20Filled,
  Receipt20Regular,
  ReceiptMoney20Filled,
  ReceiptMoney20Regular,
  type FluentIcon,
  Home20Filled,
  Home20Regular,
  People20Filled,
  People20Regular,
  PeopleCommunity20Filled,
  PeopleCommunity20Regular,
  PeopleTeam20Filled,
  PeopleTeam20Regular,
  PlugConnected20Filled,
  PlugConnected20Regular,
  PersonClock20Filled,
  PersonClock20Regular,
  PeopleQueue20Filled,
  PeopleQueue20Regular,
  CalendarClock20Filled,
  CalendarClock20Regular,
  Settings20Filled,
  Settings20Regular,
  ShieldCheckmark20Filled,
  ShieldCheckmark20Regular,
  TaskListLtr20Filled,
  TaskListLtr20Regular,
  Target20Filled,
  Target20Regular,
  Board20Filled,
  Board20Regular,
  DataTrending20Filled,
  DataTrending20Regular,
  Globe20Filled,
  Globe20Regular,
  FolderBriefcase20Filled,
  FolderBriefcase20Regular,
  ClipboardTask20Filled,
  ClipboardTask20Regular,
  // Employee Referrals (Epic 42)
  Gift20Filled,
  Gift20Regular,
  PersonAdd20Filled,
  PersonAdd20Regular,
  // Workforce planning (Epic 44)
  Organization20Filled,
  Organization20Regular,
  // Internal Mobility (Epic 41)
  ArrowSwap20Filled,
  ArrowSwap20Regular,
  // Fairness (Epic 49)
  Scales20Filled,
  Scales20Regular,
  // Recruitment marketing (Epic 39)
  Megaphone20Filled,
  Megaphone20Regular,
  // Demand Agent intake inbox (Epic 55)
  MailInbox20Filled,
  MailInbox20Regular,
  // Proposal inbox and AI group (Epic 65)
  BotSparkle20Filled,
  BotSparkle20Regular,
  BrainCircuit20Filled,
  BrainCircuit20Regular,
} from "@fluentui/react-icons";
import { ADMIN_AREA_PERMISSIONS, APPROVER_PERMISSIONS, hasAnyPermission, type PermissionMap } from "@/features/auth/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: FluentIcon;
  /** Only shown when the user holds at least one of these permissions (`me.permissions`). */
  requiresAny?: readonly string[];
  /** Live count shown as a `CounterBadge` beside the label. */
  counter?: "approvals" | "tasks" | "proposals";
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: bundleIcon(Home20Filled, Home20Regular) },
  // Employee Referrals (Epic 42): every internal User can refer a friend.
  { href: "/refer", label: "Refer a friend", icon: bundleIcon(PersonAdd20Filled, PersonAdd20Regular) },
  // Internal Mobility (Epic 41): every internal User can browse internal openings and track their applications.
  { href: "/internal-jobs", label: "Internal jobs", icon: bundleIcon(ArrowSwap20Filled, ArrowSwap20Regular) },
  {
    href: "/internal-jobs/my-applications",
    label: "My internal applications",
    icon: bundleIcon(ArrowSwap20Filled, ArrowSwap20Regular),
  },
  { href: "/demands", label: "Demands", icon: bundleIcon(Briefcase20Filled, Briefcase20Regular) },
  // Job Network (Epic 75): opt the tenant's open jobs into the public Talent OS Jobs site.
  {
    href: "/admin/job-network",
    label: "Job network",
    icon: bundleIcon(Board20Filled, Board20Regular),
    requiresAny: ["network:manage", "posting:publish_external"],
  },
  // Ecosystem console (Epic 79): everything that connects to Talent OS from outside.
  {
    href: "/admin/integrations",
    label: "Integrations",
    icon: bundleIcon(Board20Filled, Board20Regular),
    requiresAny: ["integration:view", "integration:manage"],
  },
  {
    href: "/admin/integrations/access-reviews",
    label: "Access reviews",
    icon: bundleIcon(CheckmarkCircle20Filled, CheckmarkCircle20Regular),
    requiresAny: ["integration:manage"],
  },
  // Demand Agent (Epic 55): client requirement emails / uploads awaiting a client match or drafted into demands.
  {
    href: "/demands/intake",
    label: "Intake inbox",
    icon: bundleIcon(MailInbox20Filled, MailInbox20Regular),
    requiresAny: ["demand:create"],
  },
  {
    href: "/approvals",
    label: "Approvals",
    icon: bundleIcon(CheckmarkCircle20Filled, CheckmarkCircle20Regular),
    // Also shown to anyone with a pending request at their current step (`AppNav` passes `hasPendingApprovals`).
    requiresAny: APPROVER_PERMISSIONS,
    counter: "approvals",
  },
  // Proposal inbox (Epic 65): pending Proposals assigned to me + my queues.
  {
    href: "/proposals",
    label: "Proposals",
    icon: bundleIcon(BotSparkle20Filled, BotSparkle20Regular),
    requiresAny: ["proposal:decide", "ai:govern"],
    counter: "proposals",
  },
  {
    href: "/candidates",
    label: "Candidates",
    icon: bundleIcon(People20Filled, People20Regular),
    requiresAny: ["candidate:read"],
  },
  // Talent Pools (Epic 38)
  {
    href: "/talent-pools",
    label: "Talent Pools",
    icon: bundleIcon(PeopleCommunity20Filled, PeopleCommunity20Regular),
    requiresAny: ["pool:read"],
  },
  // Recruitment marketing (Epic 39): Overview / Audiences / Campaigns / Sequences / Settings are section tabs.
  {
    href: "/marketing",
    label: "Marketing",
    icon: bundleIcon(Megaphone20Filled, Megaphone20Regular),
    requiresAny: ["campaign:read"],
  },
  {
    href: "/clients",
    label: "Clients",
    icon: bundleIcon(Building20Filled, Building20Regular),
    requiresAny: ["client:read"],
  },
  // Sales (Epic 15)
  { href: "/leads", label: "Leads", icon: bundleIcon(Target20Filled, Target20Regular), requiresAny: ["lead:read"] },
  {
    href: "/opportunities",
    label: "Opportunities",
    icon: bundleIcon(Board20Filled, Board20Regular),
    requiresAny: ["opportunity:read"],
  },
  {
    href: "/sales",
    label: "Sales dashboard",
    icon: bundleIcon(DataTrending20Filled, DataTrending20Regular),
    requiresAny: ["opportunity:read"],
  },
  // Client commercials (Epic 16)
  {
    href: "/contracts",
    label: "Contracts",
    icon: bundleIcon(DocumentText20Filled, DocumentText20Regular),
    requiresAny: ["contract:read"],
  },
  {
    href: "/purchase-orders",
    label: "Purchase orders",
    icon: bundleIcon(Receipt20Filled, Receipt20Regular),
    requiresAny: ["po:read"],
  },
  // Vendors (Epic 17)
  {
    href: "/vendors",
    label: "Vendors",
    icon: bundleIcon(BuildingPeople20Filled, BuildingPeople20Regular),
    requiresAny: ["vendor:read"],
  },
  // Delivery: SOW projects (Epic 45)
  {
    href: "/projects",
    label: "Projects",
    icon: bundleIcon(FolderBriefcase20Filled, FolderBriefcase20Regular),
    requiresAny: ["project:read"],
  },
  // Workforce planning (Epic 44)
  {
    href: "/workforce",
    label: "Workforce",
    icon: bundleIcon(Organization20Filled, Organization20Regular),
    requiresAny: ["workforce_plan:read"],
  },
  // Workforce (Epic 19)
  {
    href: "/placements",
    label: "Placements",
    icon: bundleIcon(PeopleTeam20Filled, PeopleTeam20Regular),
    requiresAny: ["placement:read"],
  },
  {
    href: "/placements/pre-joining",
    label: "Pre-joining",
    icon: bundleIcon(PersonClock20Filled, PersonClock20Regular),
    requiresAny: ["placement:read"],
  },
  // Extension & offboarding (Epic 31)
  {
    href: "/placements/ending-soon",
    label: "Ending soon",
    icon: bundleIcon(CalendarClock20Filled, CalendarClock20Regular),
    requiresAny: ["placement:read"],
  },
  {
    href: "/offboarding",
    label: "Offboarding",
    icon: bundleIcon(TaskListLtr20Filled, TaskListLtr20Regular),
    requiresAny: ["offboarding:write", "offboarding:close"],
  },
  // HRMS sync (Epic 71)
  {
    href: "/hrms/sync",
    label: "HRMS sync",
    icon: bundleIcon(PlugConnected20Filled, PlugConnected20Regular),
    requiresAny: ["hrms:sync"],
  },
  // Bench (Epic 24)
  { href: "/bench", label: "Bench", icon: bundleIcon(PeopleQueue20Filled, PeopleQueue20Regular), requiresAny: ["bench:read"] },
  // Onboarding (Epic 23)
  {
    href: "/onboarding",
    label: "Onboarding",
    icon: bundleIcon(CheckmarkCircle20Filled, CheckmarkCircle20Regular),
    requiresAny: ["onboarding:read"],
  },
  // Compliance (Epic 20)
  {
    href: "/bgv",
    label: "BGV cases",
    icon: bundleIcon(ShieldCheckmark20Filled, ShieldCheckmark20Regular),
    requiresAny: ["bgv:read"],
  },
  // Compliance (Epic 21)
  {
    href: "/compliance",
    label: "Compliance",
    icon: bundleIcon(ShieldCheckmark20Filled, ShieldCheckmark20Regular),
    requiresAny: ["compliance:read"],
  },
  {
    href: "/compliance/credentials",
    label: "Credentials",
    icon: bundleIcon(DocumentText20Filled, DocumentText20Regular),
    requiresAny: ["compliance:read"],
  },
  // Compliance, BGV & Onboarding Agents (Epic 62)
  {
    href: "/compliance/pre-start-risk",
    label: "Pre-start risk",
    icon: bundleIcon(ShieldCheckmark20Filled, ShieldCheckmark20Regular),
    requiresAny: ["compliance:read"],
  },
  {
    href: "/onboarding/questions",
    label: "Onboarding questions",
    icon: bundleIcon(CheckmarkCircle20Filled, CheckmarkCircle20Regular),
    requiresAny: ["onboarding:read"],
  },
  {
    href: "/onboarding/faq-gaps",
    label: "FAQ gaps",
    icon: bundleIcon(DocumentText20Filled, DocumentText20Regular),
    requiresAny: ["knowledge:manage", "onboarding:manage"],
  },
  {
    href: "/settings/knowledge",
    label: "Knowledge sources",
    icon: bundleIcon(DocumentText20Filled, DocumentText20Regular),
    requiresAny: ["knowledge:manage"],
  },
  // Webhooks (Epic 68): Settings -> Integrations -> Webhooks (Epic 79 may regroup it under an Integrations group).
  {
    href: "/settings/integrations/webhooks",
    label: "Webhooks",
    icon: bundleIcon(PlugConnected20Filled, PlugConnected20Regular),
    requiresAny: ["webhook:manage", "integration:view"],
  },
  // Fairness: bias audit & adverse-impact reporting (Epic 49)
  {
    href: "/fairness",
    label: "Fairness",
    icon: bundleIcon(Scales20Filled, Scales20Regular),
    requiresAny: ["fairness:read"],
  },
  // Immigration (Epic 46)
  {
    href: "/immigration",
    label: "Immigration",
    icon: bundleIcon(Globe20Filled, Globe20Regular),
    requiresAny: ["immigration:read"],
  },
  // Timesheets (Epic 25)
  {
    href: "/timesheets",
    label: "Timesheets",
    icon: bundleIcon(CalendarClock20Filled, CalendarClock20Regular),
    requiresAny: ["timesheet:read", "timesheet:monitor"],
  },
  // Leave & Holidays (Epic 26)
  {
    href: "/leave",
    label: "Leave",
    icon: bundleIcon(CalendarClock20Filled, CalendarClock20Regular),
    requiresAny: ["leave:read", "leave:read_team"],
  },
  // Expenses (Epic 27)
  {
    href: "/expenses",
    label: "Expenses",
    icon: bundleIcon(ReceiptMoney20Filled, ReceiptMoney20Regular),
    requiresAny: ["expense:read", "expense:admin", "expense:approve"],
  },
  // Payroll export (Epic 28)
  {
    href: "/payroll",
    label: "Payroll",
    icon: bundleIcon(ReceiptMoney20Filled, ReceiptMoney20Regular),
    requiresAny: ["payroll:read"],
  },
  // Billing (Epic 29)
  {
    href: "/billing/invoices",
    label: "Invoices",
    icon: bundleIcon(ReceiptMoney20Filled, ReceiptMoney20Regular),
    requiresAny: ["billing:read", "billing:write"],
  },
  {
    href: "/billing/runs",
    label: "Invoice runs",
    icon: bundleIcon(ReceiptMoney20Filled, ReceiptMoney20Regular),
    requiresAny: ["billing:write"],
  },
  {
    href: "/billing/einvoice",
    label: "E-invoicing",
    icon: bundleIcon(ReceiptMoney20Filled, ReceiptMoney20Regular),
    requiresAny: ["einvoice:write"],
  },
  // Receivables & period close (Epic 30)
  {
    href: "/receivables/payments",
    label: "Receivables",
    icon: bundleIcon(ReceiptMoney20Filled, ReceiptMoney20Regular),
    requiresAny: ["receivables:read", "payment:record"],
  },
  {
    href: "/receivables/collections",
    label: "Collections",
    icon: bundleIcon(ReceiptMoney20Filled, ReceiptMoney20Regular),
    requiresAny: ["collections:write"],
  },
  // Collections Agent rules (Epic 63)
  {
    href: "/settings/collection-rules",
    label: "Collection rules",
    icon: bundleIcon(ReceiptMoney20Filled, ReceiptMoney20Regular),
    requiresAny: ["collections:write", "billing:configure"],
  },
  {
    href: "/finance/periods",
    label: "Period close",
    icon: bundleIcon(ReceiptMoney20Filled, ReceiptMoney20Regular),
    requiresAny: ["period:close", "period:reopen"],
  },
  // Finance carry-overs (Epic 51)
  {
    href: "/finance/dsc",
    label: "DSC signing",
    icon: bundleIcon(DocumentSignature20Filled, DocumentSignature20Regular),
    requiresAny: ["dsc:configure", "invoice:issue"],
  },
  {
    href: "/finance/tds-reconciliation",
    label: "TDS reconciliation",
    icon: bundleIcon(ReceiptMoney20Filled, ReceiptMoney20Regular),
    requiresAny: ["receivables:read"],
  },
  // Ledger sync (Epic 71)
  {
    href: "/finance/ledger-sync",
    label: "Ledger sync",
    icon: bundleIcon(PlugConnected20Filled, PlugConnected20Regular),
    requiresAny: ["ledger:sync"],
  },
  {
    href: "/interviews",
    label: "Interviews",
    icon: bundleIcon(CalendarLtr20Filled, CalendarLtr20Regular),
    requiresAny: ["interview:read", "interview:schedule", "scorecard:submit"],
  },
  // Recruiting: Employee Referrals (Epic 42)
  {
    href: "/referrals/rewards",
    label: "Referral rewards",
    icon: bundleIcon(Gift20Filled, Gift20Regular),
    requiresAny: ["referral:read"],
  },
  {
    href: "/referrals",
    label: "Referrals",
    icon: bundleIcon(PersonAdd20Filled, PersonAdd20Regular),
    requiresAny: ["referral:read"],
  },
  {
    href: "/admin/referrals",
    label: "Referral programs",
    icon: bundleIcon(Gift20Filled, Gift20Regular),
    requiresAny: ["referral:configure"],
  },
  // Internal Mobility (Epic 41): board settings, eligibility defaults, employee grades.
  {
    href: "/admin/mobility",
    label: "Internal mobility",
    icon: bundleIcon(ArrowSwap20Filled, ArrowSwap20Regular),
    requiresAny: ["mobility:manage"],
  },
  // Recruiting: Assessments (Epic 40)
  {
    href: "/assessments",
    label: "Assessments",
    icon: bundleIcon(ClipboardTask20Filled, ClipboardTask20Regular),
    requiresAny: ["assessment:read", "assessment:author"],
  },
  // Recruiting: Campus & Events (Epic 43)
  {
    href: "/campus/drives",
    label: "Campus drives",
    icon: bundleIcon(PeopleTeam20Filled, PeopleTeam20Regular),
    requiresAny: ["campus:read"],
  },
  {
    href: "/campus/institutions",
    label: "Institutions",
    icon: bundleIcon(Building20Filled, Building20Regular),
    requiresAny: ["campus:read"],
  },
  {
    href: "/campus/events",
    label: "Recruitment events",
    icon: bundleIcon(CalendarClock20Filled, CalendarClock20Regular),
    requiresAny: ["event:manage", "campus:read"],
  },
  {
    href: "/offers",
    label: "Offers",
    icon: bundleIcon(DocumentSignature20Filled, DocumentSignature20Regular),
    requiresAny: ["offer:read"],
  },
  {
    href: "/documents/verify",
    label: "Verify document",
    icon: bundleIcon(ShieldCheckmark20Filled, ShieldCheckmark20Regular),
    requiresAny: ["document:verify"],
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: bundleIcon(TaskListLtr20Filled, TaskListLtr20Regular),
    requiresAny: ["task:read"],
    counter: "tasks",
  },
  {
    href: "/admin",
    label: "Admin",
    icon: bundleIcon(Settings20Filled, Settings20Regular),
    requiresAny: ADMIN_AREA_PERMISSIONS,
  },
];

export type NavGroup = {
  value: string;
  label: string;
  icon: FluentIcon;
  requiresAny?: readonly string[];
  /** The group is rendered just before the item with this href (or last). */
  before?: string;
  items: Omit<NavItem, "icon" | "counter">[];
};

/** Collapsible "Reports" group (Epic 11): dashboard drill-down lists and the user's exports. */
export const REPORTS_NAV_GROUP: NavGroup = {
  value: "reports",
  label: "Reports",
  icon: bundleIcon(DataBarVertical20Filled, DataBarVertical20Regular),
  requiresAny: ["report:read", "report:export", "skills_insight:read", "report:build"],
  before: "/admin",
  items: [
    { href: "/reports/applications", label: "Applications", requiresAny: ["report:read"] },
    { href: "/reports/submissions", label: "Submissions", requiresAny: ["report:read"] },
    { href: "/reports/interviews", label: "Interviews", requiresAny: ["report:read"] },
    { href: "/reports/offers", label: "Offers", requiresAny: ["report:read"] },
    // Epic 37: skills supply and demand insight.
    { href: "/reports/skills", label: "Skills", requiresAny: ["skills_insight:read"] },
    // Epic 47: custom report builder & scheduled reports.
    { href: "/reports/custom", label: "Custom reports", requiresAny: ["report:read", "report:build"] },
    // Epic 64: Analytics Agent ("Ask about your data"; the page also checks copilot:use).
    { href: "/reports/ask", label: "Ask about your data", requiresAny: ["report:read"] },
    { href: "/exports", label: "My exports", requiresAny: ["report:export"] },
  ],
};

/** Collapsible "AI" group (Epic 65): Copilot history (Epic 54), the AI governance console and agent settings. */
export const AI_NAV_GROUP: NavGroup = {
  value: "ai",
  label: "AI",
  icon: bundleIcon(BrainCircuit20Filled, BrainCircuit20Regular),
  requiresAny: ["copilot:use", "ai:govern", "ai:agent_configure"],
  before: "/admin",
  items: [
    // The Copilot panel itself opens from the header (Alt+C).
    { href: "/ai/copilot", label: "Copilot history", requiresAny: ["copilot:use"] },
    { href: "/admin/ai/runs", label: "AI governance", requiresAny: ["ai:govern"] },
    { href: "/admin/ai/agents", label: "AI agents", requiresAny: ["ai:govern", "ai:agent_configure"] },
  ],
};

/**
 * Sidebar layout (M365 style). The flat `NAV_ITEMS` above stays the source of truth (permissions, counters,
 * tests); these constants only decide how `AppNav` groups them visually. A pinned set sits at the top, the rest
 * are organised into collapsible sections, and `/admin` is pinned at the bottom. Any visible item not pinned and
 * not placed in a section still renders at the top level, so nothing can silently disappear.
 */

/** Cross-cutting "my work" inboxes, pinned at the very top in this order (they keep their counters). */
export const TOP_NAV_HREFS: readonly string[] = ["/dashboard", "/approvals", "/proposals", "/tasks"];

/** Pinned at the very bottom. */
export const BOTTOM_NAV_HREFS: readonly string[] = ["/admin"];

export type NavSection = { value: string; label: string; icon: FluentIcon; hrefs: readonly string[] };

/** Collapsible sections, in display order. `hrefs` are listed in the order they should appear within a section. */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    value: "sales",
    label: "Sales & clients",
    icon: bundleIcon(Building20Filled, Building20Regular),
    hrefs: ["/leads", "/opportunities", "/sales", "/clients", "/contracts", "/purchase-orders", "/vendors"],
  },
  {
    value: "recruiting",
    label: "Recruiting",
    icon: bundleIcon(Briefcase20Filled, Briefcase20Regular),
    hrefs: [
      "/demands",
      "/demands/intake",
      "/candidates",
      "/talent-pools",
      "/marketing",
      "/interviews",
      "/assessments",
      "/offers",
      "/admin/job-network",
    ],
  },
  {
    value: "campus",
    label: "Campus",
    icon: bundleIcon(PeopleTeam20Filled, PeopleTeam20Regular),
    hrefs: ["/campus/drives", "/campus/institutions", "/campus/events"],
  },
  {
    value: "referrals",
    label: "Referrals & mobility",
    icon: bundleIcon(PersonAdd20Filled, PersonAdd20Regular),
    hrefs: [
      "/refer",
      "/internal-jobs",
      "/internal-jobs/my-applications",
      "/referrals",
      "/referrals/rewards",
      "/admin/referrals",
      "/admin/mobility",
    ],
  },
  {
    value: "delivery",
    label: "Delivery & workforce",
    icon: bundleIcon(FolderBriefcase20Filled, FolderBriefcase20Regular),
    hrefs: [
      "/projects",
      "/workforce",
      "/placements",
      "/placements/pre-joining",
      "/placements/ending-soon",
      "/offboarding",
      "/bench",
      "/hrms/sync",
    ],
  },
  {
    value: "compliance",
    label: "Onboarding & compliance",
    icon: bundleIcon(ShieldCheckmark20Filled, ShieldCheckmark20Regular),
    hrefs: [
      "/onboarding",
      "/onboarding/questions",
      "/onboarding/faq-gaps",
      "/settings/knowledge",
      "/bgv",
      "/compliance",
      "/compliance/credentials",
      "/compliance/pre-start-risk",
      "/immigration",
      "/fairness",
      "/documents/verify",
    ],
  },
  {
    value: "time",
    label: "Time & pay",
    icon: bundleIcon(CalendarClock20Filled, CalendarClock20Regular),
    hrefs: ["/timesheets", "/leave", "/expenses", "/payroll"],
  },
  {
    value: "finance",
    label: "Billing & finance",
    icon: bundleIcon(ReceiptMoney20Filled, ReceiptMoney20Regular),
    hrefs: [
      "/billing/invoices",
      "/billing/runs",
      "/billing/einvoice",
      "/receivables/payments",
      "/receivables/collections",
      "/settings/collection-rules",
      "/finance/periods",
      "/finance/dsc",
      "/finance/tds-reconciliation",
      "/finance/ledger-sync",
    ],
  },
  {
    value: "integrations",
    label: "Integrations",
    icon: bundleIcon(PlugConnected20Filled, PlugConnected20Regular),
    hrefs: ["/admin/integrations", "/admin/integrations/access-reviews", "/settings/integrations/webhooks"],
  },
];

/** Nav items visible to a user with `permissions`. */
export function visibleNavItems<T extends Pick<NavItem, "requiresAny">>(items: readonly T[], permissions: PermissionMap): T[] {
  return items.filter((item) => !item.requiresAny || hasAnyPermission(permissions, item.requiresAny));
}

/** The nav item whose route contains `pathname`, if any. */
export function activeNavHref(pathname: string): string | undefined {
  // Every AI governance console tab (Epic 65) highlights "AI governance".
  if (/^\/admin\/ai\/(runs|proposals|log|violations|costs|copilot-usage|evals)(\/|$)/.test(pathname)) return "/admin/ai/runs";
  // The longest matching href wins (e.g. "/admin/ai/runs/…" selects "AI governance", not "Admin").
  return [...NAV_ITEMS, ...REPORTS_NAV_GROUP.items, ...AI_NAV_GROUP.items]
    .map(({ href }) => href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}
