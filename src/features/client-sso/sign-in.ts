/**
 * Client Portal email-first sign-in with company SSO (Epic 50, FR-251). Pure logic, tested in `client-sso.test.ts`.
 *
 * After the email field loses focus the form asks `/client-portal/auth/sso/discover`. A match shows
 * "Sign in with your company account" as the primary action; when SSO is required the magic-link button is
 * hidden behind "Can't use company sign-in?" (the server still decides who may use a link).
 */
import type { ClientSsoDiscoverOut } from "./types";

export type PortalSignInMode = {
  showSso: boolean;
  showMagicLink: boolean;
  /** "Can't use company sign-in?" link that reveals the magic-link button. */
  showFallbackLink: boolean;
  note: string | null;
};

export const SSO_REQUIRED_MESSAGE = "Your organisation signs in with its company account.";

export function portalSignInMode(discovery: ClientSsoDiscoverOut | null, fallbackRequested: boolean): PortalSignInMode {
  if (!discovery?.sso || !discovery.idp_id) return { showSso: false, showMagicLink: true, showFallbackLink: false, note: null };
  if (discovery.required && !fallbackRequested) {
    return { showSso: true, showMagicLink: false, showFallbackLink: true, note: SSO_REQUIRED_MESSAGE };
  }
  return { showSso: true, showMagicLink: true, showFallbackLink: false, note: null };
}

export function shouldDiscoverPortal(tenantSlug: string, email: string): boolean {
  return tenantSlug.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** A discovery result applies only while the workspace + email it was asked for are unchanged. */
export function discoveryKey(tenantSlug: string, email: string): string {
  return `${tenantSlug.trim().toLowerCase()}|${email.trim().toLowerCase()}`;
}

/** Full-page navigation target that starts company sign-in (the backend redirects to the IdP). */
export function portalSsoStartUrl(idpId: string, tenantSlug: string, next: string): string {
  const q = new URLSearchParams({ tenant: tenantSlug, next });
  return `/api/v1/client-portal/auth/sso/${encodeURIComponent(idpId)}/start?${q.toString()}`;
}

const SSO_ERRORS: Record<string, string> = {
  sso_no_client_user: "Ask your account manager to give you access to the client portal.",
  sso_email_unverified: "Your company account did not confirm your email address.",
  sso_domain_not_allowed: "Your email domain is not allowed for this organisation's sign-in.",
  client_user_inactive: "Your portal access is suspended or revoked. Contact your account manager.",
  sso_identity_conflict: "This portal account is already linked to a different company identity.",
  sso_required: "Your organisation requires company sign-in.",
};
const SSO_FAILED = "Company sign-in failed. Try again or use an emailed sign-in link.";

/** Message for `/client/sign-in?sso_error=<code>` after a failed IdP round trip. */
export function portalSsoErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return SSO_ERRORS[code] ?? SSO_FAILED;
}

/** `?mfa=1` -> TOTP challenge, `?mfa=enroll` -> authenticator enrolment, else none. */
export function portalMfaParam(value: string | null | undefined): "challenge" | "enroll" | null {
  if (value === "1") return "challenge";
  if (value === "enroll") return "enroll";
  return null;
}

/**
 * Where to send the user after a 403 `sso_required` (`details.sign_in_url`): a same-origin path only,
 * falling back to the portal sign-in page.
 */
export function safeSignInUrl(url: unknown, origin?: string): string {
  const fallback = "/client/sign-in";
  if (typeof url !== "string" || !url) return fallback;
  if (url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\")) return url;
  if (!origin) return fallback;
  try {
    const u = new URL(url);
    return u.origin === origin ? `${u.pathname}${u.search}` : fallback;
  } catch {
    return fallback;
  }
}
