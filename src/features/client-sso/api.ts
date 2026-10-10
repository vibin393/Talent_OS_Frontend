import { api } from "@/lib/api/client";
import { CLIENT_PORTAL_PREFIX, clientPortalRequest } from "@/lib/api/client-portal-client";
import type { ClientUserOut, PortalAuthOut } from "@/lib/api/types";
import type {
  ClientIdentityProviderIn,
  ClientIdentityProviderOut,
  ClientIdentityProviderUpdate,
  ClientIdpMetadataImportIn,
  ClientSsoDiscoverOut,
  ClientSsoExemptionIn,
  ClientSsoExemptionOut,
  ClientSsoSettingsIn,
  ClientSsoSettingsOut,
} from "./types";

const V = "/api/v1";
const enc = encodeURIComponent;
const base = (clientId: string) => `${V}/clients/${enc(clientId)}/sso`;
const idp = (clientId: string, idpId: string) => `${base(clientId)}/identity-providers/${enc(idpId)}`;

export const clientSsoKeys = {
  all: (clientId: string) => ["client-sso", clientId] as const,
  providers: (clientId: string) => ["client-sso", clientId, "providers"] as const,
  settings: (clientId: string) => ["client-sso", clientId, "settings"] as const,
  exemptions: (clientId: string) => ["client-sso", clientId, "exemptions"] as const,
  portalUsers: (clientId: string) => ["client-portal-users", clientId] as const,
};

/** Internal admin endpoints (`client_sso:manage`; `api` adds the CSRF header on writes). */
export const clientSsoApi = {
  providers: (clientId: string, signal?: AbortSignal) =>
    api.get<ClientIdentityProviderOut[]>(`${base(clientId)}/identity-providers`, { signal }),
  create: (clientId: string, body: ClientIdentityProviderIn) =>
    api.post<ClientIdentityProviderOut>(`${base(clientId)}/identity-providers`, body),
  update: (clientId: string, idpId: string, body: ClientIdentityProviderUpdate) =>
    api.patch<ClientIdentityProviderOut>(idp(clientId, idpId), body),
  remove: (clientId: string, idpId: string) => api.delete<void>(idp(clientId, idpId)),
  importMetadata: (clientId: string, idpId: string, body: ClientIdpMetadataImportIn) =>
    api.post<ClientIdentityProviderOut>(`${idp(clientId, idpId)}/metadata-import`, body),
  testUrl: (clientId: string, idpId: string) => api.post<{ url: string }>(`${idp(clientId, idpId)}/test`),
  settings: (clientId: string, signal?: AbortSignal) => api.get<ClientSsoSettingsOut>(`${base(clientId)}/settings`, { signal }),
  saveSettings: (clientId: string, body: ClientSsoSettingsIn) => api.put<ClientSsoSettingsOut>(`${base(clientId)}/settings`, body),
  exemptions: (clientId: string, signal?: AbortSignal) =>
    api.get<ClientSsoExemptionOut[]>(`${base(clientId)}/exemptions`, { signal }),
  addExemption: (clientId: string, body: ClientSsoExemptionIn) =>
    api.post<ClientSsoExemptionOut>(`${base(clientId)}/exemptions`, body),
  removeExemption: (clientId: string, clientUserId: string) =>
    api.delete<void>(`${base(clientId)}/exemptions/${enc(clientUserId)}`),
  portalUsers: (clientId: string, signal?: AbortSignal) =>
    api.get<ClientUserOut[]>(`${V}/clients/${enc(clientId)}/portal-users`, { signal }),
};

/** SP metadata download (GET with the session cookie, opened in a new tab). */
export function clientSpMetadataUrl(clientId: string, idpId: string): string {
  return `${idp(clientId, idpId)}/sp-metadata`;
}

/** Public Client Portal endpoints (no `tos_client` session yet). */
export const clientPortalSsoApi = {
  discover: (tenantSlug: string, email: string) =>
    clientPortalRequest<ClientSsoDiscoverOut>(`${CLIENT_PORTAL_PREFIX}/auth/sso/discover`, {
      method: "POST",
      body: { tenant_slug: tenantSlug, email },
      quiet401: true,
    }),
  /** Uses the `tos_mfa` cookie set by the SSO redirect; returns the enrolment QR secret. */
  mfaEnrollment: () =>
    clientPortalRequest<PortalAuthOut>(`${CLIENT_PORTAL_PREFIX}/auth/sso/mfa-enrollment`, { method: "POST", quiet401: true }),
};
