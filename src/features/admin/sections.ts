import { hasPermission, type PermissionMap } from "@/features/auth/permissions";

export type AdminSection = {
  href: string;
  label: string;
  description: string;
  /** Permission needed to open the page. */
  permission: string;
  /** Alternatively, any one of these permissions opens the page. */
  anyOf?: readonly string[];
};

export const ADMIN_HOME = "/admin";

/** Admin area pages. */
export const ADMIN_SECTIONS: readonly AdminSection[] = [
  {
    href: "/admin/users",
    label: "Users",
    description: "Invite people, assign roles, teams and business units, and deactivate accounts.",
    permission: "user:read",
  },
  {
    href: "/admin/invitations",
    label: "Pending invitations",
    description: "Resend or revoke invitations that have not been accepted yet.",
    permission: "user:read",
  },
  {
    href: "/admin/roles",
    label: "Roles",
    description: "Review system roles and build custom roles from permissions and scopes.",
    permission: "role:read",
  },
  {
    href: "/admin/teams",
    label: "Teams",
    description: "Group users into teams and choose team leads.",
    permission: "team:read",
  },
  {
    href: "/admin/business-units",
    label: "Business units",
    description: "Organize teams and users into business units.",
    permission: "business_unit:read",
  },
  {
    href: "/admin/audit-log",
    label: "Audit log",
    description: "See who changed what and when, and export the log as CSV.",
    permission: "audit:read",
  },
  {
    href: "/admin/skills",
    label: "Skill catalog",
    description: "Search the skill catalog, add skills and aliases, and review pending skills.",
    permission: "settings:manage",
  },
  {
    href: "/admin/settings",
    label: "Settings",
    description: "Company profile, regional settings, ID prefixes, link expiries and links to every other setting.",
    permission: "settings:manage",
  },
  {
    href: "/admin/privacy",
    label: "Privacy",
    description: "Data subject requests, legal holds, consent notices, retention and vendor support access.",
    permission: "dsr:read",
    anyOf: ["privacy:manage", "retention:manage", "support_access:approve"],
  },
  {
    href: "/admin/ai",
    label: "AI",
    description: "Turn AI features on or off, review the monthly budget and the AI action log, and AI assistant access (MCP).",
    permission: "ai:admin",
    anyOf: ["ai_log:read", "ai:govern", "ai:agent_configure"],
  },
  {
    href: "/admin/approval-chains",
    label: "Approval chains",
    description: "Choose who approves demands before they open, with conditional steps.",
    permission: "settings:manage",
  },
  {
    href: "/admin/pipeline",
    label: "Pipeline",
    description: "Pipeline stages, rejection and withdrawal reasons, screening questionnaires and submission rules.",
    permission: "pipeline:configure",
  },
  {
    href: "/admin/interviews",
    label: "Interviews",
    description: "Interview kits with competencies and questions, stage templates, reminders and scorecard settings.",
    permission: "interview:configure",
  },
  {
    href: "/admin/offer-templates",
    label: "Offer letters",
    description: "Offer letter templates with merge fields, default expiry and signatory.",
    permission: "offer_template:manage",
  },
  {
    href: "/admin/documents/templates",
    label: "Document templates",
    description: "Agreements, letters and policies with merge fields, signing order, eSign provider and versions.",
    permission: "document_template:manage",
  },
  {
    href: "/admin/sla",
    label: "SLAs",
    description: "Demand SLA targets, working hours and holidays, plus SLA targets for Phase 2 records (vendors, BGV, timesheets, invoices).",
    permission: "settings:manage",
    anyOf: ["sla:read"],
  },
  {
    href: "/admin/career-site",
    label: "Career site",
    description: "Turn on the public career site, set its branding and the stage labels candidates see.",
    permission: "career_site:configure",
  },
  {
    href: "/admin/email-templates",
    label: "Email templates",
    description: "Edit the messages people send from Talent OS and automated emails, with merge fields.",
    permission: "email_template:manage",
  },
  {
    href: "/admin/messaging",
    label: "Messaging",
    description: "SMS and WhatsApp providers, DLT / approved templates, quiet hours, opt-outs and the manual send queue.",
    permission: "messaging:configure",
  },
  {
    href: "/admin/workflows",
    label: "Workflows",
    description: "Automate routine steps with rules: when something happens, assign, create tasks, notify or email.",
    permission: "workflow:read",
  },
  {
    href: "/admin/escalations",
    label: "Escalations",
    description: "Automation: notify or reassign approval steps and tasks that wait too long. Never approves or rejects.",
    permission: "sla:read",
  },
  {
    href: "/admin/vendors",
    label: "Vendors",
    description: "Vendor ownership and duplicate windows, mandatory documents and the progress labels vendors see.",
    permission: "vendor:write",
  },
  // Epic 23: onboarding templates and settings.
  {
    href: "/admin/onboarding/templates",
    label: "Onboarding templates",
    description: "Joiner checklists matched by client, legal entity, worker type and country: forms, documents, eSign, policies and internal tasks.",
    permission: "onboarding:configure",
  },
  {
    href: "/admin/bgv",
    label: "Background verification",
    description: "BGV packages (checks, documents, lawful-basis attestation), providers and reference questionnaires.",
    permission: "bgv:configure",
  },
  // Epic 21: compliance requirements and credential types.
  {
    href: "/admin/compliance",
    label: "Compliance",
    description: "Credential types and the requirements each placement must meet (credentials, documents, BGV, policies).",
    permission: "compliance:configure",
  },
  // Epic 27: expense policies (versioned category rules, Client overrides).
  {
    href: "/admin/expense-policies",
    label: "Expense policies",
    description: "Category limits, receipt rules, mileage rates, client re-billing and AI receipt reading.",
    permission: "expense:policy",
  },
  // Epic 31: offboarding checklist templates and exit settings.
  {
    href: "/settings/offboarding",
    label: "Offboarding",
    description: "Exit checklist templates, ending-soon alerts, early attrition and bench rules.",
    permission: "offboarding:configure",
  },
  // Epic 28: payroll export (pay calendars, file mappings, connector, late-item rules).
  {
    href: "/admin/payroll",
    label: "Payroll",
    description: "Pay calendars per legal entity, payroll file column mappings, the payroll connector and late-item rules.",
    permission: "payroll:configure",
  },
  // Epic 14 (FR-76 / FR-77): legal entities and single sign-on live under /settings.
  {
    href: "/settings/legal-entities",
    label: "Legal entities",
    description: "Companies that contract and invoice: PAN, GST registrations, LUTs, bank accounts and signatories.",
    permission: "legal_entity:read",
  },
  // Epic 51: live FX reference-rate feed.
  {
    href: "/settings/fx-feed",
    label: "FX feed",
    description: "Daily reference exchange rates: currency pairs, manual vs feed precedence, staleness and fetch runs.",
    permission: "fx_feed:configure",
  },
  {
    href: "/settings/sso",
    label: "Single sign-on",
    description: "Sign in with your corporate identity provider (OIDC or SAML), enforcement and break-glass admins.",
    permission: "sso:manage",
  },
  // Epic 42: employee referral programs and settings.
  {
    href: "/admin/referrals",
    label: "Referral programs",
    description: "Who can refer, eligible openings, reward rules and joining condition, exclusions and referral link settings.",
    permission: "referral:configure",
  },
  // Epic 41: internal mobility (job board, manager approval, eligibility defaults, employee grades).
  {
    href: "/admin/mobility",
    label: "Internal mobility",
    description: "Internal job board for Users and Workers, manager approval, disclosure text, default tenure and employee grades import.",
    permission: "mobility:manage",
  },
  // Epic 48: predictive analytics (model cards, enable/disable, thresholds).
  {
    href: "/admin/predictions",
    label: "Predictions",
    description: "Time-to-fill, offer-drop and attrition models: status, model cards, enable or disable, data thresholds and risk bands.",
    permission: "model:manage",
  },
  // Epic 35: go-live data import (workers, placements, opening invoices, leave balances from CSV).
  {
    href: "/admin/go-live",
    label: "Go-live import",
    description: "Load existing workers, placements, opening invoices and leave balances from CSV, with a preview before applying.",
    permission: "golive:import",
  },
  {
    href: "/admin/security",
    label: "Security",
    description: "Require multi-factor authentication and manage API keys for integrations.",
    permission: "settings:read",
    anyOf: ["api_key:manage"],
  },
  // Epic 67: private apps for the Public API and MCP.
  {
    href: "/admin/apps",
    label: "Apps",
    description: "Register private apps that use the Public API or connect AI assistants, and manage their secrets.",
    permission: "app:develop",
    anyOf: ["integration:view"],
  },
];

export function visibleAdminSections(permissions: PermissionMap): AdminSection[] {
  return ADMIN_SECTIONS.filter(
    (s) => hasPermission(permissions, s.permission) || (s.anyOf ?? []).some((p) => hasPermission(permissions, p)),
  );
}

/** The section whose route contains `pathname`; `/admin` itself (and unknown sub-paths) map to home. */
export function activeAdminHref(pathname: string): string {
  return ADMIN_SECTIONS.find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`))?.href ?? ADMIN_HOME;
}
