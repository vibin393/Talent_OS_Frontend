/**
 * Module navigation registry (native unification, Frappe-style).
 *
 * The unified shell shows ONE app at a time. Inside a module (`/apps/{module}/…`) the left sidebar
 * swaps to that module's OWN full menu — mirroring the app's real navigation. Each item opens either:
 *   - a NATIVE Talent OS page (`native: true`, e.g. the dashboard we rebuilt), or
 *   - the app's EXISTING page deep-embedded (chrome-hidden) via `/apps/{module}/m/<deep path>`.
 *
 * This reuses each app's existing frontend instead of rebuilding every screen; high-traffic screens
 * can be upgraded to native over time by flipping an item to a native route.
 */

import {
  bundleIcon,
  Board20Filled,
  Board20Regular,
  Briefcase20Filled,
  Briefcase20Regular,
  Building20Filled,
  Building20Regular,
  DataBarVertical20Filled,
  DataBarVertical20Regular,
  Gift20Filled,
  Gift20Regular,
  Globe20Filled,
  Globe20Regular,
  Home20Filled,
  Home20Regular,
  People20Filled,
  People20Regular,
  Poll20Filled,
  Poll20Regular,
  Settings20Filled,
  Settings20Regular,
  type FluentIcon,
} from "@fluentui/react-icons";
import type { ModuleKey } from "./api";

export type ModuleNavItem = {
  /** In-shell route. Native page, or a deep-embed route `/apps/{module}/m/<path>`. */
  href: string;
  label: string;
};

export type ModuleNavGroup = {
  title?: string;
  icon: FluentIcon;
  items: ModuleNavItem[];
};

export type ModuleNav = {
  key: ModuleKey;
  label: string;
  /** Native landing page for the module (the dashboard we rebuilt). */
  dashboardHref: string;
  groups: ModuleNavGroup[];
};

// The module KEY ("feedbackiq") differs from its URL segment ("feedback-iq").
const URL_SEG: Record<ModuleKey, string> = { croar: "croar", feedbackiq: "feedback-iq", portal: "portal" };

/** Deep-embed route for an existing app page: `/apps/{url-seg}/m/<deep path>`. */
export function embedHref(module: ModuleKey, deepPath: string): string {
  return `/apps/${URL_SEG[module]}/m${deepPath.startsWith("/") ? "" : "/"}${deepPath}`;
}

const e = embedHref;

export const MODULE_NAVS: Record<ModuleKey, ModuleNav> = {
  // Croar is the AI LAYER of the unified platform (decision D1): recruiting/HR/payroll live in
  // Talent OS, so Croar's menu is trimmed to only what is UNIQUE to it — AI copilot, AI sourcing,
  // automation workflows, and the assessment engine. The duplicated modules are intentionally gone.
  croar: {
    key: "croar",
    label: "Croar AI",
    dashboardHref: "/apps/croar",
    groups: [
      {
        title: "AI Copilot",
        icon: bundleIcon(Board20Filled, Board20Regular),
        items: [{ href: e("croar", "/enterprise/croar-pilot"), label: "Croar Pilot" }],
      },
      {
        title: "Sourcing",
        icon: bundleIcon(People20Filled, People20Regular),
        items: [
          { href: e("croar", "/enterprise/sourcing/hub"), label: "Sourcing Hub" },
          { href: e("croar", "/enterprise/matches"), label: "AI Matches" },
        ],
      },
      {
        title: "Automation",
        icon: bundleIcon(Board20Filled, Board20Regular),
        items: [
          { href: e("croar", "/enterprise/automation"), label: "Canvas" },
          { href: e("croar", "/enterprise/automation/assessment"), label: "Assessment flows" },
          { href: e("croar", "/enterprise/automation/interview"), label: "Interview flows" },
        ],
      },
      {
        title: "Assessments",
        icon: bundleIcon(DataBarVertical20Filled, DataBarVertical20Regular),
        items: [
          { href: e("croar", "/enterprise/skill-assessments"), label: "Skill Assessments" },
          { href: e("croar", "/enterprise/assessments-360"), label: "360 Assessments" },
        ],
      },
    ],
  },
  feedbackiq: {
    key: "feedbackiq",
    label: "Feedback IQ",
    dashboardHref: "/apps/feedback-iq",
    groups: [
      {
        title: "Customer feedback",
        icon: bundleIcon(Poll20Filled, Poll20Regular),
        items: [
          { href: e("feedbackiq", "/managesurvey"), label: "CSAT history" },
          { href: e("feedbackiq", "/survey-tag"), label: "Tags" },
        ],
      },
      {
        title: "Rewards & recognition",
        icon: bundleIcon(Gift20Filled, Gift20Regular),
        items: [
          { href: e("feedbackiq", "/badge/give/all"), label: "Badges" },
          { href: e("feedbackiq", "/prize/history"), label: "Prizes" },
        ],
      },
      {
        title: "Gamification",
        icon: bundleIcon(Board20Filled, Board20Regular),
        items: [
          { href: e("feedbackiq", "/contest"), label: "Contests" },
          { href: e("feedbackiq", "/external-metric"), label: "External metrics" },
          { href: e("feedbackiq", "/task"), label: "My tasks" },
        ],
      },
      {
        title: "Analytics",
        icon: bundleIcon(DataBarVertical20Filled, DataBarVertical20Regular),
        items: [
          { href: e("feedbackiq", "/reports"), label: "Reports" },
          { href: e("feedbackiq", "/dashboard"), label: "Dashboard" },
          { href: e("feedbackiq", "/dashboard/employee"), label: "Employee dashboard" },
        ],
      },
      {
        title: "Organization",
        icon: bundleIcon(People20Filled, People20Regular),
        items: [
          { href: e("feedbackiq", "/employee"), label: "Employees" },
          { href: e("feedbackiq", "/department"), label: "Teams" },
          { href: e("feedbackiq", "/location"), label: "Locations" },
          { href: e("feedbackiq", "/position"), label: "Positions" },
          { href: e("feedbackiq", "/companyprofile"), label: "Company profile" },
        ],
      },
      {
        title: "Settings",
        icon: bundleIcon(Settings20Filled, Settings20Regular),
        items: [
          { href: e("feedbackiq", "/company/modules"), label: "Modules" },
          { href: e("feedbackiq", "/company/role"), label: "Permissions" },
          { href: e("feedbackiq", "/settings/integration"), label: "Integrations" },
          { href: e("feedbackiq", "/settings/survey"), label: "CSAT settings" },
          { href: e("feedbackiq", "/settings/badge"), label: "Badge settings" },
          { href: e("feedbackiq", "/settings/prize"), label: "Prize settings" },
        ],
      },
    ],
  },
  portal: {
    key: "portal",
    label: "Job Portal",
    dashboardHref: "/apps/portal",
    groups: [
      {
        title: "Jobs",
        icon: bundleIcon(Briefcase20Filled, Briefcase20Regular),
        items: [
          { href: e("portal", "/hiring/job-listing"), label: "Jobs & responses" },
          { href: e("portal", "/hiring/job/post"), label: "Post a job" },
          { href: e("portal", "/hiring/invites"), label: "Invites sent" },
        ],
      },
      {
        title: "Candidates",
        icon: bundleIcon(People20Filled, People20Regular),
        items: [
          { href: e("portal", "/hiring/resdex"), label: "Candidate search" },
          { href: e("portal", "/hiring/resdex/saved-searches"), label: "Saved searches" },
          { href: e("portal", "/hiring/resdex/folders"), label: "Folders" },
          { href: e("portal", "/hiring/resdex/saved"), label: "Saved for later" },
        ],
      },
      {
        title: "General",
        icon: bundleIcon(Settings20Filled, Settings20Regular),
        items: [
          { href: e("portal", "/hiring/reports"), label: "Reports" },
          { href: e("portal", "/hiring/company"), label: "Company profile" },
          { href: e("portal", "/hiring/settings"), label: "Settings" },
        ],
      },
    ],
  },
};

const GROUP_ICON_FALLBACK = bundleIcon(Home20Filled, Home20Regular);
export const MODULE_ICONS = {
  dashboard: bundleIcon(Home20Filled, Home20Regular),
  group: GROUP_ICON_FALLBACK,
  building: bundleIcon(Building20Filled, Building20Regular),
  globe: bundleIcon(Globe20Filled, Globe20Regular),
  gift: bundleIcon(Gift20Filled, Gift20Regular),
  poll: bundleIcon(Poll20Filled, Poll20Regular),
  settings: bundleIcon(Settings20Filled, Settings20Regular),
};

/** The module whose menu should drive the sidebar for this route, or null for Talent OS itself. */
export function moduleForPath(pathname: string): ModuleKey | null {
  const m = /^\/apps\/(croar|feedback-iq|portal)(\/|$)/.exec(pathname);
  if (!m) return null;
  return (m[1] === "feedback-iq" ? "feedbackiq" : m[1]) as ModuleKey;
}
