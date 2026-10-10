import { errorMessage, isApiError } from "@/lib/api/errors";

const MESSAGES: Record<string, string> = {
  invalid_credentials: "Incorrect email or password.",
  invalid_transition: "This change is not allowed from the tenant's current status.",
  slug_mismatch: "The slug you typed does not match this tenant.",
  notice_period_too_short: "Sub-processors must be announced at least 30 days before they take effect. Use the emergency override with a reason if this cannot wait.",
  support_grant_not_approved: "The tenant has not approved this request yet.",
  support_access_ended: "This support grant has ended.",
  tenant_exists: "A tenant with this slug already exists.",
  mfa_enrollment_required: "Set up multi-factor authentication first.",
  rate_limited: "Too many attempts. Wait a moment and try again.",
};

export function platformErrorMessage(e: unknown): string {
  if (isApiError(e)) {
    const known = MESSAGES[e.code];
    if (known) return known;
    if (e.status === 404) return "This item no longer exists. Refresh and try again.";
    if (e.status === 429) return MESSAGES.rate_limited;
  }
  return errorMessage(e);
}

export const TENANT_STATUS_COLORS: Record<string, "success" | "warning" | "danger" | "subtle" | "informative"> = {
  active: "success",
  suspended: "warning",
  offboarding: "danger",
  deleted: "subtle",
};

export const SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;
export const SEVERITY_COLORS: Record<string, "informative" | "subtle" | "warning" | "danger" | "severe"> = {
  info: "informative",
  low: "subtle",
  medium: "warning",
  high: "severe",
  critical: "danger",
};

/** Days until `iso` (rounded up; 0 once passed). */
export function daysUntil(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.ceil((t - now.getTime()) / 86_400_000));
}

/** The 30-day sub-processor notice rule: an entry effective sooner needs the emergency override. */
export const SUB_PROCESSOR_NOTICE_DAYS = 30;
export function needsEmergencyOverride(effectiveFrom: string, now: Date = new Date()): boolean {
  const t = Date.parse(effectiveFrom);
  if (!Number.isFinite(t)) return false;
  return t < now.getTime() + SUB_PROCESSOR_NOTICE_DAYS * 86_400_000;
}

/** Hours left in the 24 h incident notification window (negative once late). */
export function incidentHoursLeft(confirmedAt: string, now: Date = new Date()): number {
  return (Date.parse(confirmedAt) + 24 * 3_600_000 - now.getTime()) / 3_600_000;
}
