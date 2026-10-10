/**
 * Client Portal SSO types (Epic 50, FR-250..252). Hand-written (do not regenerate `schema.d.ts` for these).
 * Mirrors the backend pydantic schemas of `/api/v1/clients/{client_id}/sso/*` and `/client-portal/auth/sso/*`.
 */
export type ClientIdpKind = "oidc" | "saml";
export type ClientIdpStatus = "draft" | "active" | "disabled";

export type ClientOidcConfig = { issuer: string; client_id: string; scopes?: string[] };
export type ClientSamlConfig = {
  idp_entity_id: string;
  sso_url: string;
  x509_certs: string[];
  email_attribute?: string | null;
  name_attribute?: string | null;
};

export type ClientIdentityProviderIn = {
  name: string;
  kind: ClientIdpKind;
  email_domains: string[];
  oidc?: ClientOidcConfig | null;
  saml?: ClientSamlConfig | null;
  client_secret?: string | null;
  jit_enabled?: boolean;
  jit_default_permissions?: string[];
  mfa_trusted?: boolean;
};

export type ClientIdentityProviderUpdate = Partial<Omit<ClientIdentityProviderIn, "kind">> & { status?: ClientIdpStatus };

export type ClientIdentityProviderOut = {
  id: string;
  client_id: string;
  name: string;
  kind: ClientIdpKind;
  status: ClientIdpStatus;
  email_domains: string[];
  config: Record<string, unknown>;
  has_secret: boolean;
  jit_enabled: boolean;
  jit_default_permissions: string[];
  mfa_trusted: boolean;
  linked_users: number;
  last_login_at: string | null;
  redirect_uri: string | null;
  sp_entity_id: string | null;
  acs_url: string | null;
  warnings: string[];
  created_at: string;
  updated_at: string;
};

export type ClientIdpMetadataImportIn = { metadata_url?: string; metadata_xml?: string };

export type ClientSsoSettingsOut = {
  client_id: string;
  sso_required: boolean;
  approval_links_allowed: boolean;
  has_active_idp: boolean;
  exemption_count: number;
  warnings: string[];
  sign_in_url: string;
  updated_at: string | null;
};

export type ClientSsoSettingsIn = { sso_required?: boolean; approval_links_allowed?: boolean };

export type ClientSsoExemptionOut = {
  client_user_id: string;
  display_name: string;
  email: string;
  status: string;
  reason: string;
  mfa_enforced: boolean;
  mfa_enabled: boolean;
  created_at: string;
};

export type ClientSsoExemptionIn = { client_user_id: string; reason: string };

export type ClientSsoTestResultOut = {
  test: true;
  audience: "client";
  subject: string;
  email: string | null;
  email_verified: boolean;
  name: string | null;
  groups: string[];
  resolution: "linked" | "email_match" | "jit" | "refused";
  reason: string | null;
  client_user_id: string | null;
};

/** `POST /client-portal/auth/sso/discover` (identical shape for unknown domains). */
export type ClientSsoDiscoverOut = { sso: boolean; idp_id: string | null; required: boolean };
