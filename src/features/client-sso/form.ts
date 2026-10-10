/**
 * Pure helpers of the Client 360 "Single sign-on" tab (Epic 50, FR-250..252): wizard form state,
 * validation, form -> payload, server error / warning messages and the enforcement card rules.
 * Tested in `client-sso.test.ts`.
 */
import { isApiError } from "@/lib/api/errors";
import type {
  ClientIdentityProviderIn,
  ClientIdentityProviderOut,
  ClientIdentityProviderUpdate,
  ClientIdpKind,
  ClientSsoSettingsOut,
} from "./types";

export type SamlSource = "manual" | "metadata_url" | "metadata_xml";

export type IdpForm = {
  name: string;
  kind: ClientIdpKind;
  // OIDC
  issuer: string;
  clientId: string;
  /** Write-only: empty keeps the stored secret. */
  clientSecret: string;
  // SAML
  samlSource: SamlSource;
  metadataUrl: string;
  metadataXml: string;
  entityId: string;
  ssoUrl: string;
  /** One or more PEM certificates. */
  certs: string;
  emailAttribute: string;
  nameAttribute: string;
  // Sign-in
  domains: string;
  jitEnabled: boolean;
  jitPermissions: string[];
  mfaTrusted: boolean;
};

export type IdpFormErrors = Partial<Record<keyof IdpForm, string>>;

export const EMPTY_IDP_FORM: IdpForm = {
  name: "",
  kind: "oidc",
  issuer: "",
  clientId: "",
  clientSecret: "",
  samlSource: "manual",
  metadataUrl: "",
  metadataXml: "",
  entityId: "",
  ssoUrl: "",
  certs: "",
  emailAttribute: "",
  nameAttribute: "",
  domains: "",
  jitEnabled: false,
  jitPermissions: [],
  mfaTrusted: false,
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Edit form prefilled from a saved provider (the secret is never returned). */
export function idpFormFromOut(idp: ClientIdentityProviderOut): IdpForm {
  const c = idp.config ?? {};
  const certs = Array.isArray(c.x509_certs) ? c.x509_certs.filter((x): x is string => typeof x === "string") : [];
  return {
    ...EMPTY_IDP_FORM,
    name: idp.name,
    kind: idp.kind,
    issuer: str(c.issuer),
    clientId: str(c.client_id),
    entityId: str(c.idp_entity_id),
    ssoUrl: str(c.sso_url),
    certs: certs.join("\n\n"),
    emailAttribute: str(c.email_attribute),
    nameAttribute: str(c.name_attribute),
    domains: idp.email_domains.join(", "),
    jitEnabled: idp.jit_enabled,
    jitPermissions: [...idp.jit_default_permissions],
    mfaTrusted: idp.mfa_trusted,
  };
}

/** "acme.com, @Acme.in\nacme.co.uk" -> ["acme.com", "acme.in", "acme.co.uk"] (deduplicated). */
export function parseDomains(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const d = raw.trim().toLowerCase().replace(/^@/, "");
    if (d && !out.includes(d)) out.push(d);
  }
  return out;
}

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function isValidDomain(domain: string): boolean {
  return DOMAIN_RE.test(domain);
}

/** Split pasted PEM text into individual certificates (bare base64 bodies separated by blank lines). */
export function parseCerts(text: string): string[] {
  const pem = text.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if (pem) return pem.map((c) => c.trim());
  return text
    .split(/\n\s*\n/)
    .map((c) => c.trim())
    .filter(Boolean);
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

/** True when the SAML config comes from metadata (imported right after the draft is saved). */
export function usesMetadataImport(form: IdpForm): boolean {
  return form.kind === "saml" && form.samlSource !== "manual";
}

/** Fields that must be valid before the "Connection" step can continue. */
export function validateConnection(form: IdpForm, editing: boolean): IdpFormErrors {
  const e: IdpFormErrors = {};
  if (!form.name.trim()) e.name = "Enter a name.";
  if (form.kind === "oidc") {
    if (!form.issuer.trim()) e.issuer = "Enter the issuer URL.";
    else if (!isHttpsUrl(form.issuer)) e.issuer = "The issuer must be an https:// URL.";
    if (!form.clientId.trim()) e.clientId = "Enter the client ID.";
  } else if (form.samlSource === "metadata_url") {
    if (!isHttpsUrl(form.metadataUrl)) e.metadataUrl = "Enter an https:// metadata URL.";
  } else if (form.samlSource === "metadata_xml") {
    if (!/<(\w+:)?EntityDescriptor[\s>]/.test(form.metadataXml)) e.metadataXml = "Paste the IdP metadata XML (EntityDescriptor).";
  } else {
    if (!form.entityId.trim()) e.entityId = "Enter the IdP entity ID.";
    if (!form.ssoUrl.trim()) e.ssoUrl = "Enter the single sign-on URL.";
    else if (!isHttpsUrl(form.ssoUrl)) e.ssoUrl = "The single sign-on URL must use https://.";
    // When editing, an empty box keeps the stored certificates.
    if ((!editing || form.certs.trim()) && parseCerts(form.certs).length === 0) e.certs = "Paste at least one signing certificate.";
  }
  return e;
}

/** Domains (at least one) and JIT permissions (a non-empty subset of the Client Portal permissions). */
export function validateSignIn(form: IdpForm, allowedPermissions: readonly string[]): IdpFormErrors {
  const e: IdpFormErrors = {};
  const domains = parseDomains(form.domains);
  if (domains.length === 0) e.domains = "Add at least one email domain.";
  else {
    const bad = domains.filter((d) => !isValidDomain(d));
    if (bad.length) e.domains = `Not a valid domain: ${bad.join(", ")}`;
  }
  if (form.jitEnabled) {
    const unknown = form.jitPermissions.filter((p) => !allowedPermissions.includes(p));
    if (unknown.length) e.jitPermissions = `Unknown portal permission: ${unknown.join(", ")}`;
    else if (form.jitPermissions.length === 0) e.jitPermissions = "Choose at least one default permission for new users.";
  }
  return e;
}

export function validateIdpForm(form: IdpForm, allowedPermissions: readonly string[], editing: boolean): IdpFormErrors {
  return { ...validateConnection(form, editing), ...validateSignIn(form, allowedPermissions) };
}

function samlPayload(form: IdpForm) {
  return {
    idp_entity_id: form.entityId.trim(),
    sso_url: form.ssoUrl.trim(),
    x509_certs: parseCerts(form.certs),
    email_attribute: form.emailAttribute.trim() || null,
    name_attribute: form.nameAttribute.trim() || null,
  };
}

function common(form: IdpForm, allowedPermissions: readonly string[]) {
  return {
    name: form.name.trim(),
    email_domains: parseDomains(form.domains),
    jit_enabled: form.jitEnabled,
    jit_default_permissions: form.jitEnabled ? form.jitPermissions.filter((p) => allowedPermissions.includes(p)) : [],
    mfa_trusted: form.mfaTrusted,
  };
}

/** Create body. A SAML provider configured from metadata is saved without `saml` and imported right after. */
export function toCreatePayload(form: IdpForm, allowedPermissions: readonly string[]): ClientIdentityProviderIn {
  const body: ClientIdentityProviderIn = { kind: form.kind, ...common(form, allowedPermissions) };
  if (form.kind === "oidc") {
    body.oidc = { issuer: form.issuer.trim(), client_id: form.clientId.trim() };
    if (form.clientSecret) body.client_secret = form.clientSecret;
  } else if (!usesMetadataImport(form)) {
    body.saml = samlPayload(form);
  }
  return body;
}

/** PATCH body: the secret only when re-entered; manual SAML config only when certificates are present. */
export function toUpdatePayload(form: IdpForm, allowedPermissions: readonly string[]): ClientIdentityProviderUpdate {
  const body: ClientIdentityProviderUpdate = { ...common(form, allowedPermissions) };
  if (form.kind === "oidc") {
    body.oidc = { issuer: form.issuer.trim(), client_id: form.clientId.trim() };
    if (form.clientSecret) body.client_secret = form.clientSecret;
  } else if (!usesMetadataImport(form) && form.certs.trim()) {
    body.saml = samlPayload(form);
  }
  return body;
}

/** Metadata import body (exactly one of URL / XML), or null for a manual configuration. */
export function toMetadataImport(form: IdpForm): { metadata_url: string } | { metadata_xml: string } | null {
  if (form.kind !== "saml") return null;
  if (form.samlSource === "metadata_url") return { metadata_url: form.metadataUrl.trim() };
  if (form.samlSource === "metadata_xml") return { metadata_xml: form.metadataXml.trim() };
  return null;
}

const WARNINGS: Record<string, string> = {
  certificate_expires_soon: "A signing certificate expires soon. Ask the client for the new certificate.",
  certificate_expired: "A signing certificate has expired. Sign-in fails until it is replaced.",
  no_break_glass: "SSO is required and no user is exempt. If the client's identity provider fails, nobody can sign in.",
  no_active_idp: "No identity provider is active for this client.",
};

export function warningMessage(code: string): string {
  return WARNINGS[code] ?? code.replace(/_/g, " ");
}

const GENERIC = "Something went wrong. Please try again.";

/** User-facing message for an admin API error (the codes of the Epic 50 contract). */
export function clientSsoErrorMessage(e: unknown): string {
  if (!isApiError(e)) return GENERIC;
  const list = (key: string) => {
    const v = e.details[key];
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").join(", ") : "";
  };
  switch (e.code) {
    case "allowed_domains_required":
      return "Add at least one email domain.";
    case "sso_domain_taken": {
      const d = list("domains");
      return `${d ? `${d}: ` : "This "}email domain already belongs to another identity provider in this workspace.`;
    }
    case "invalid_portal_permission":
      return "One of the default permissions is not a Client Portal permission.";
    case "sso_config_incomplete": {
      const m = list("missing");
      return `The configuration is incomplete${m ? ` (missing: ${m})` : ""}.`;
    }
    case "sso_certificate_invalid":
      return "The signing certificate is not a valid X.509 certificate.";
    case "sso_certificate_expired":
      return "The signing certificate has expired.";
    case "sso_https_required":
      return "Identity provider URLs must use https://.";
    case "client_idp_required":
      return "Activate an identity provider before requiring SSO.";
    case "client_user_not_found":
      return "That user does not have portal access for this client.";
    default:
      if (e.status === 0) return "Cannot reach the server. Check your connection and try again.";
      if (e.status >= 500) return GENERIC;
      return e.message || GENERIC;
  }
}

/** Wizard field a server error belongs to. */
export function errorField(e: unknown): keyof IdpForm | null {
  if (!isApiError(e)) return null;
  if (e.code === "allowed_domains_required" || e.code === "sso_domain_taken") return "domains";
  if (e.code === "invalid_portal_permission") return "jitPermissions";
  if (e.code === "sso_certificate_invalid" || e.code === "sso_certificate_expired") return "certs";
  return null;
}

export type EnforcementState = {
  requireDisabled: boolean;
  requireTooltip: string | null;
  showNoBreakGlass: boolean;
};

/** Enforcement card rules: SSO can be turned on only with an active IdP (turning it off is always allowed). */
export function enforcementState(settings: ClientSsoSettingsOut | undefined, exemptions: number, busy = false): EnforcementState {
  if (!settings) return { requireDisabled: true, requireTooltip: null, showNoBreakGlass: false };
  const noIdp = !settings.has_active_idp && !settings.sso_required;
  return {
    requireDisabled: busy || noIdp,
    requireTooltip: noIdp ? "Activate an identity provider first" : null,
    showNoBreakGlass: settings.sso_required && (settings.warnings.includes("no_break_glass") || exemptions === 0),
  };
}

export const MIN_REASON = 3;
export const MAX_REASON = 1000;

export function validateExemptionReason(reason: string): string | null {
  const r = reason.trim();
  if (r.length < MIN_REASON) return "Give a reason (at least 3 characters).";
  if (r.length > MAX_REASON) return "Keep the reason under 1000 characters.";
  return null;
}
