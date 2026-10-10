import { api } from "@/lib/api/client";
import type {
  BreakGlassAdminOut,
  IdentityProviderIn,
  IdentityProviderOut,
  IdentityProviderUpdate,
  SsoDiscoverOut,
} from "./types";

const V = "/api/v1";
const enc = encodeURIComponent;

export const ssoKeys = {
  all: ["sso"] as const,
  providers: ["sso", "providers"] as const,
  breakGlass: ["sso", "break-glass"] as const,
};

export const ssoApi = {
  providers: (signal?: AbortSignal) => api.get<IdentityProviderOut[]>(`${V}/sso/identity-providers`, { signal }),
  create: (body: IdentityProviderIn) => api.post<IdentityProviderOut>(`${V}/sso/identity-providers`, body),
  update: (id: string, body: IdentityProviderUpdate) =>
    api.patch<IdentityProviderOut>(`${V}/sso/identity-providers/${enc(id)}`, body),
  remove: (id: string) => api.delete<void>(`${V}/sso/identity-providers/${enc(id)}`),
  setGroupRoles: (id: string, mappings: { group_value: string; role_id: string }[]) =>
    api.put<IdentityProviderOut>(`${V}/sso/identity-providers/${enc(id)}/group-roles`, mappings),
  testUrl: (id: string) => api.post<{ url: string }>(`${V}/sso/identity-providers/${enc(id)}/test`),
  breakGlass: (signal?: AbortSignal) => api.get<BreakGlassAdminOut[]>(`${V}/sso/break-glass-admins`, { signal }),
  setBreakGlass: (userId: string, breakGlass: boolean) =>
    api.put<BreakGlassAdminOut>(`${V}/sso/break-glass-admins/${enc(userId)}`, { break_glass: breakGlass }),
  /** Public: domain match only (identical shape for unknown emails). */
  discover: (tenantSlug: string, email: string) =>
    api.post<SsoDiscoverOut>(`${V}/auth/sso/discover`, { tenant_slug: tenantSlug, email }, { skipAuthHandler: true }),
};

/** Browser navigation target that starts SSO sign-in (the backend redirects to the IdP). */
export function ssoStartUrl(idpId: string, tenantSlug: string, next?: string): string {
  const q = new URLSearchParams({ tenant: tenantSlug });
  if (next) q.set("next", next);
  return `${V}/auth/sso/${enc(idpId)}/start?${q.toString()}`;
}
