/**
 * Permission gating helpers over `me.permissions` (`{"resource:action": scope}`, story 1.5).
 * The UI gates navigation and actions on permissions, never on role keys; the backend enforces them
 * again on every request.
 */

export const SCOPES = ["own", "team", "bu", "tenant"] as const;
export type Scope = (typeof SCOPES)[number];

export type PermissionMap = Record<string, string> | null | undefined;

export const SCOPE_LABELS: Record<Scope, string> = {
  own: "Own records",
  team: "Team",
  bu: "Business unit",
  tenant: "Whole organization",
};

function scopeRank(scope: string | undefined): number {
  return scope === undefined ? -1 : SCOPES.indexOf(scope as Scope);
}

/** True if `permissions` grants `perm` at `minScope` or wider (any known scope when omitted). */
export function hasPermission(permissions: PermissionMap, perm: string, minScope?: Scope): boolean {
  const granted = permissions?.[perm];
  const rank = scopeRank(granted);
  if (rank < 0) return false;
  return minScope === undefined || rank >= scopeRank(minScope);
}

export function hasAnyPermission(permissions: PermissionMap, perms: readonly string[]): boolean {
  return perms.some((p) => hasPermission(permissions, p));
}

/** Permissions that decide at least one kind of approval step (demands, offers, rate exceptions, timesheets,
 * expenses, leave, bank details, invoices, write-offs, period reopen, campaigns, referral rewards, workforce plans).
 * Holding any of them opens the Approvals inbox; anyone who is the current approver of a pending request also sees
 * it (the inbox count). Deciding is still checked server-side per step. */
export const APPROVER_PERMISSIONS = [
  "demand:approve",
  "offer:approve",
  "timesheet:approve",
  "expense:approve",
  "leave:approve",
  "worker_bank:approve",
  "campaign:approve",
  "referral_reward:approve",
  "workforce_plan:approve",
  "invoice:issue",
  "invoice:write_off",
  "period:reopen",
] as const;

/** Permissions that each unlock at least one page of the Admin area. */
export const ADMIN_AREA_PERMISSIONS = [
  // Epic 20: BGV packages, providers, reference questionnaires.
  "bgv:configure",
  "user:read",
  "role:read",
  "team:read",
  "business_unit:read",
  "audit:read",
  "settings:read",
  "settings:manage",
  "ai:admin",
  // Epic 12: privacy center, AI action log, API keys.
  "dsr:read",
  "privacy:manage",
  "retention:manage",
  "support_access:approve",
  "ai_log:read",
  "api_key:manage",
  // Epic 9: career site settings.
  "career_site:configure",
  // Epic 10: email templates and workflow rules.
  "email_template:manage",
  "workflow:read",
  // Epic 6: pipeline stages, reasons, questionnaires and submission rules.
  "pipeline:configure",
  // Epic 7 / 8: interview kits and templates, offer letter templates.
  "interview:configure",
  "offer_template:manage",
  // Epic 22: document templates.
  "document_template:manage",
  // Epic 33: SMS / WhatsApp messaging admin.
  "messaging:configure",
  // Epic 14: legal entities and single sign-on.
  "legal_entity:read",
  "sso:manage",
  // Epic 23: onboarding templates.
  "onboarding:configure",
  // Epic 21: compliance requirements and credential types.
  "compliance:configure",
  // Epic 27: expense policies.
  "expense:policy",
  // Epic 51: FX feed settings.
  "fx_feed:configure",
  // Epic 42: referral programs and settings.
  "referral:configure",
  // Epic 41: internal mobility settings and employee grades.
  "mobility:manage",
  // Epic 48: predictive analytics models and settings.
  "model:manage",
  // Epic 65: AI governance console and agent settings (/admin/ai/*).
  "ai:govern",
  "ai:agent_configure",
  "ai:kill_switch",
] as const;

export function canAccessAdmin(permissions: PermissionMap): boolean {
  return hasAnyPermission(permissions, ADMIN_AREA_PERMISSIONS);
}
