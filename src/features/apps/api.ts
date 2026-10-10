/** Private apps, Connected apps and the OAuth consent client (Epic 67). Hand-written DTOs. */
import { api } from "@/lib/api/client";

const V = "/api/v1";

export type AppStatus = "development" | "published" | "suspended" | "retired";

export type AppOut = {
  id: string;
  client_id: string;
  name: string;
  slug: string;
  publisher_kind: string;
  client_type: "confidential" | "public";
  grant_types: string[];
  resources: string[];
  requested_scopes: string[];
  status: AppStatus;
  manifest_version: number;
  created_at: string;
  description: string | null;
  redirect_uris: string[];
  scope_reasons: Record<string, string>;
  homepage_url: string | null;
  privacy_url: string | null;
  support_email: string | null;
  reconsent_installations: number;
};

export type AppSecretOut = {
  id: string;
  prefix: string;
  fingerprint: string;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
};

export type AppDetail = AppOut & { secrets: AppSecretOut[]; installation_id: string | null };
export type AppCreated = AppOut & { client_secret: string | null };
export type SecretCreated = { secret_id: string; client_secret: string; fingerprint: string; prefix: string; previous_expires_at: string | null };

export type AppCreateIn = {
  name: string;
  description?: string;
  client_type: "confidential" | "public";
  grant_types: string[];
  redirect_uris: string[];
  resources: string[];
  requested_scopes: string[];
  scope_reasons: Record<string, string>;
  homepage_url?: string | null;
  privacy_url?: string | null;
  support_email?: string | null;
};

export type ScopeInfo = { key: string; label: string; description: string; sensitive: boolean; resources: string[]; api_key_allowed: boolean };

export type ConnectedApp = {
  id: string;
  installation_id: string;
  app_id: string | null;
  app_name: string;
  publisher_kind: string;
  publisher_name: string;
  resource: "api" | "mcp";
  scopes: string[];
  scope_labels: string[];
  granted_at: string;
  last_used_at: string | null;
};

export const appsKeys = {
  list: ["apps", "list"] as const,
  detail: (id: string) => ["apps", "detail", id] as const,
  scopes: ["apps", "scopes"] as const,
  connected: ["me", "connected-apps"] as const,
};

export const appsApi = {
  list: (signal?: AbortSignal) => api.get<AppOut[]>(`${V}/apps`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<AppDetail>(`${V}/apps/${id}`, { signal }),
  scopes: (signal?: AbortSignal) => api.get<ScopeInfo[]>(`${V}/apps/scopes`, { signal }),
  create: (body: AppCreateIn) => api.post<AppCreated>(`${V}/apps`, body),
  rotate: (id: string) => api.post<SecretCreated>(`${V}/apps/${id}/secrets/rotate`),
  revokeSecret: (id: string, secretId: string, confirmLast: boolean) =>
    api.post<void>(`${V}/apps/${id}/secrets/${secretId}/revoke`, { confirm_last: confirmLast }),
  retire: (id: string, reason: string) => api.post<AppOut>(`${V}/apps/${id}/retire`, { reason }),
  connected: (signal?: AbortSignal) => api.get<ConnectedApp[]>(`${V}/me/connected-apps`, { signal }),
  removeConnected: (id: string) => api.delete<void>(`${V}/me/connected-apps/${id}`),
  publicScopes: (scopes: string[]) => api.get<string[]>(`${V}/api-keys/public-scopes?scopes=${encodeURIComponent(scopes.join(","))}`),
};

// ---------------------------------------------------------------- consent
export type ConsentScope = { key: string; label: string; description: string; purpose_text: string; sensitive: boolean };
export type ConsentState = "ok" | "app_not_installed" | "needs_admin_approval" | "mcp_disabled";
export type AuthorizeView = {
  request_id: string;
  app_name: string;
  scopes: string[];
  resource: "api" | "mcp";
  state: ConsentState;
  app: {
    name: string;
    logo_url: string | null;
    publisher_kind: string;
    publisher_name: string;
    verified: boolean;
    homepage_url: string | null;
    privacy_url: string | null;
  } | null;
  scope_details: ConsentScope[];
  unavailable_scopes: ConsentScope[];
  not_held_scopes: ConsentScope[];
  data_flows: { direction: string; entity: string; fields: string[]; purpose: string; destination_country: string | null }[];
  existing_authorization: { scopes: string[]; granted_at: string } | null;
};
export type AuthorizeResponse = AuthorizeView | { redirect_to: string };

export const consentApi = {
  view: (query: string) => api.get<AuthorizeResponse>(`/api/oauth/authorize/view?${query}`),
  decide: (requestId: string, approve: boolean, scopes?: string[]) =>
    api.post<{ redirect_to: string }>(`/api/oauth/authorize/decision`, { request_id: requestId, approve, scopes }),
};
