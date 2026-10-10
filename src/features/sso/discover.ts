/**
 * Email-first login with SSO discovery (Epic 14, FR-77). Pure state logic, tested in `discover.test.ts`.
 *
 * After the email field loses focus the login form asks `/auth/sso/discover`. A match shows "Continue with
 * SSO" as the primary action; when SSO is required the password field is hidden behind a note, but the
 * break-glass link "Sign in with password" stays visible (the server decides).
 */
import type { SsoDiscoverOut } from "./types";

export type LoginMode = {
  /** Show the "Continue with SSO" primary button. */
  showSso: boolean;
  /** Show the password field (and the password Sign in button as primary when no SSO). */
  showPassword: boolean;
  /** Show the "Sign in with password" break-glass link. */
  showPasswordLink: boolean;
  /** Note displayed above the SSO button when SSO is required. */
  note: string | null;
};

export function loginMode(discovery: SsoDiscoverOut | null, passwordRequested: boolean): LoginMode {
  if (!discovery?.sso || !discovery.idp_id) {
    return { showSso: false, showPassword: true, showPasswordLink: false, note: null };
  }
  if (discovery.required && !passwordRequested) {
    return {
      showSso: true,
      showPassword: false,
      showPasswordLink: true,
      note: "Your organization signs you in with single sign-on.",
    };
  }
  return { showSso: true, showPassword: true, showPasswordLink: false, note: null };
}

/** Same rule as the backend `discover`: only the domain of a plausible email is sent. */
export function shouldDiscover(tenantSlug: string, email: string): boolean {
  return tenantSlug.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

const SSO_ERRORS: Record<string, string> = {
  sso_required: "Your organization requires single sign-on. Use “Continue with SSO”.",
  user_deactivated: "Your account is deactivated. Contact your administrator.",
  seat_limit_reached: "Your workspace has no free seats. Contact your administrator.",
  sso_no_account: "No Talent OS account exists for this email. Ask your administrator to invite you.",
  sso_email_unverified: "Your identity provider did not confirm your email address.",
  sso_identity_conflict: "This account is linked to another identity. Contact your administrator.",
  sso_assertion_invalid: "Single sign-on failed. Try again.",
};

/** Message for `/login?sso_error=<code>` after a failed IdP round trip. */
export function ssoErrorMessage(code: string | undefined | null): string | null {
  if (!code) return null;
  return SSO_ERRORS[code] ?? "Single sign-on failed. Try again.";
}
