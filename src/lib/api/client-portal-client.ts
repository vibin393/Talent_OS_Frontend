/**
 * Client Portal API client (Epic 14, FR-78): `/api/v1/client-portal/*` with the `tos_client` session.
 * Epic 18 content modules import `clientPortalRequest` for their own endpoints.
 */
import { createPortalRequest } from "./external-portal-request";
import type { ExternalMeOut, PortalAuthOut, PortalMfaIn, PortalStatusOut } from "./types";

export const CLIENT_PORTAL_PREFIX = "/api/v1/client-portal";
export const CLIENT_SIGN_IN = "/client/sign-in";
const P = CLIENT_PORTAL_PREFIX;

export const clientPortalRequest = createPortalRequest(P, CLIENT_SIGN_IN);

export const clientPortalKeys = {
  all: ["client-portal"] as const,
  me: ["client-portal", "me"] as const,
};

export const clientPortalApi = {
  me: (signal?: AbortSignal) => clientPortalRequest<ExternalMeOut>(`${P}/me`, { signal, quiet401: true }),
  logout: () => clientPortalRequest<void>(`${P}/auth/logout`, { method: "POST", quiet401: true }),
  requestLink: (tenantSlug: string, email: string) =>
    clientPortalRequest<PortalStatusOut>(`${P}/auth/request-link`, {
      method: "POST",
      body: { tenant_slug: tenantSlug, email },
      quiet401: true,
    }),
  verifyLink: (token: string) =>
    clientPortalRequest<PortalAuthOut>(`${P}/auth/verify-link`, { method: "POST", body: { token }, quiet401: true }),
  verifyCode: (tenantSlug: string, email: string, code: string) =>
    clientPortalRequest<PortalAuthOut>(`${P}/auth/verify-code`, {
      method: "POST",
      body: { tenant_slug: tenantSlug, email, code },
      quiet401: true,
    }),
  mfaVerify: (body: PortalMfaIn) =>
    clientPortalRequest<PortalAuthOut>(`${P}/auth/mfa/verify`, { method: "POST", body, quiet401: true }),
};
