/**
 * FR-82 permission-denied contract (Epic 14), pure helpers.
 *
 * The backend's 403 envelope carries `details {action, required_permission, ask}`; `ask` is
 * `tenant_admin` for Users and `account_manager` for portal principals. A 403 `csrf_failed` is not an access
 * problem (see `csrf-retry.ts`).
 */
import { isApiError } from "@/lib/api/errors";

export type AskWhom = "tenant_admin" | "account_manager";

export type AccessDeniedInfo = {
  action: string | null;
  requiredPermission: string | null;
  ask: AskWhom;
};

const NOT_ACCESS_CODES = new Set(["csrf_failed", "mfa_enrollment_required", "tenant_suspended", "tenant_offboarding"]);

/** The Access Denied details of a 403 error, else null. */
export function accessDeniedFrom(error: unknown, fallbackAsk: AskWhom = "tenant_admin"): AccessDeniedInfo | null {
  if (!isApiError(error) || error.status !== 403 || NOT_ACCESS_CODES.has(error.code)) return null;
  const d = error.details;
  const ask = d.ask === "account_manager" || d.ask === "tenant_admin" ? d.ask : fallbackAsk;
  return {
    action: typeof d.action === "string" ? d.action : null,
    requiredPermission:
      typeof d.required_permission === "string" ? d.required_permission : typeof d.permission === "string" ? d.permission : null,
    ask,
  };
}

export function askLabel(ask: AskWhom): string {
  return ask === "account_manager" ? "Ask your Account Manager" : "Ask your Tenant Admin";
}

/** One-line message for mutation error toasts. */
export function accessDeniedMessage(info: AccessDeniedInfo): string {
  const what = info.action ? `You don't have access to: ${info.action}.` : "You don't have access to do this.";
  return `${what} ${askLabel(info.ask)}.`;
}
