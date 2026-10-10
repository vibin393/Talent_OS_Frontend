/**
 * Vendor Portal API client (Epic 14, FR-79): `/api/v1/vendor-portal/*` with the `tos_vendor` session.
 * Epic 17 content modules use `vendorPortalRequest` (same signature as their interim `request`).
 */
import { createPortalRequest } from "./external-portal-request";
import type {
  ExternalMeOut,
  PortalAuthOut,
  PortalInviteOut,
  PortalMfaIn,
  PortalStatusOut,
  VendorPortalUserInviteIn,
  VendorPortalUserOut,
  VendorPortalUserUpdate,
} from "./types";

export const VENDOR_PORTAL_PREFIX = "/api/v1/vendor-portal";
export const VENDOR_SIGN_IN = "/vendor/sign-in";
const P = VENDOR_PORTAL_PREFIX;
const enc = encodeURIComponent;

export const vendorPortalRequest = createPortalRequest(P, VENDOR_SIGN_IN);

export const vendorPortalAuthKeys = {
  me: ["vendor-portal", "me"] as const,
  users: ["vendor-portal", "users"] as const,
};

export const vendorPortalAuthApi = {
  me: (signal?: AbortSignal) => vendorPortalRequest<ExternalMeOut>(`${P}/me`, { signal, quiet401: true }),
  logout: () => vendorPortalRequest<void>(`${P}/auth/logout`, { method: "POST", quiet401: true }),
  login: (tenantSlug: string, email: string, password: string) =>
    vendorPortalRequest<PortalAuthOut>(`${P}/auth/login`, {
      method: "POST",
      body: { tenant_slug: tenantSlug, email, password },
      quiet401: true,
    }),
  mfaVerify: (body: PortalMfaIn) =>
    vendorPortalRequest<PortalAuthOut>(`${P}/auth/mfa/verify`, { method: "POST", body, quiet401: true }),
  lookupInvite: (token: string) =>
    vendorPortalRequest<PortalInviteOut>(`${P}/auth/invitations/lookup`, { method: "POST", body: { token }, quiet401: true }),
  acceptInvite: (token: string, password: string, displayName?: string) =>
    vendorPortalRequest<PortalAuthOut>(`${P}/auth/invitations/accept`, {
      method: "POST",
      body: { token, password, display_name: displayName || null },
      quiet401: true,
    }),
  requestReset: (tenantSlug: string, email: string) =>
    vendorPortalRequest<PortalStatusOut>(`${P}/auth/password-reset/request`, {
      method: "POST",
      body: { tenant_slug: tenantSlug, email },
      quiet401: true,
    }),
  confirmReset: (token: string, password: string) =>
    vendorPortalRequest<PortalStatusOut>(`${P}/auth/password-reset/confirm`, {
      method: "POST",
      body: { token, password },
      quiet401: true,
    }),
  users: (signal?: AbortSignal) => vendorPortalRequest<VendorPortalUserOut[]>(`${P}/users`, { signal }),
  inviteUser: (body: VendorPortalUserInviteIn) =>
    vendorPortalRequest<VendorPortalUserOut>(`${P}/users`, { method: "POST", body }),
  updateUser: (id: string, body: VendorPortalUserUpdate) =>
    vendorPortalRequest<VendorPortalUserOut>(`${P}/users/${enc(id)}`, { method: "PATCH", body }),
  setUserActive: (id: string, active: boolean) =>
    vendorPortalRequest<VendorPortalUserOut>(`${P}/users/${enc(id)}/${active ? "reactivate" : "deactivate"}`, {
      method: "POST",
    }),
};
