/** Single sign-on admin + login types (Epic 14, FR-77). Hand-written until `npm run gen:api` runs. */
export type IdpKind = "oidc" | "saml";
export type IdpStatus = "draft" | "active" | "disabled";
export type EnforceMode = "none" | "all" | "roles";

export type OidcConfig = { issuer: string; client_id: string; scopes?: string[] };
export type SamlConfig = { idp_entity_id: string; sso_url: string; x509_certs: string[]; email_attribute?: string | null };

export type IdentityProviderOut = {
  id: string;
  name: string;
  kind: IdpKind;
  status: IdpStatus;
  email_domains: string[];
  config: Record<string, unknown>;
  has_secret: boolean;
  enforce_for: EnforceMode;
  enforced_role_ids: string[];
  jit_enabled: boolean;
  jit_default_role_id: string | null;
  group_claim: string | null;
  mfa_trusted: boolean;
  linked_users: number;
  group_roles: { group_value: string; role_id: string }[];
  redirect_uri: string | null;
  sp_entity_id: string | null;
  acs_url: string | null;
  metadata_url: string | null;
  created_at: string;
  updated_at: string;
};

export type IdentityProviderIn = {
  name: string;
  kind: IdpKind;
  email_domains: string[];
  oidc?: OidcConfig;
  saml?: SamlConfig;
  client_secret?: string;
  enforce_for?: EnforceMode;
  enforced_role_ids?: string[];
  jit_enabled?: boolean;
  jit_default_role_id?: string | null;
  group_claim?: string | null;
  mfa_trusted?: boolean;
};

export type IdentityProviderUpdate = Partial<Omit<IdentityProviderIn, "kind">> & { status?: IdpStatus };

export type BreakGlassAdminOut = {
  user_id: string;
  name: string;
  email: string;
  is_active: boolean;
  mfa_enabled: boolean;
  break_glass: boolean;
};

export type SsoDiscoverOut = { sso: boolean; idp_id?: string | null; required: boolean };
