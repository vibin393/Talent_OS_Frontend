import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  clientSsoErrorMessage,
  EMPTY_IDP_FORM,
  enforcementState,
  errorField,
  type IdpForm,
  idpFormFromOut,
  parseCerts,
  parseDomains,
  toCreatePayload,
  toMetadataImport,
  toUpdatePayload,
  validateConnection,
  validateExemptionReason,
  validateSignIn,
} from "./form";
import {
  discoveryKey,
  portalMfaParam,
  portalSignInMode,
  portalSsoErrorMessage,
  portalSsoStartUrl,
  safeSignInUrl,
  shouldDiscoverPortal,
} from "./sign-in";
import type { ClientIdentityProviderOut, ClientSsoSettingsOut } from "./types";

const PERMS = ["submissions:review", "demands:approve", "time:approve", "placements:view", "invoices:view"];
const CERT = "-----BEGIN CERTIFICATE-----\nMIIBszCCAVmgAwIBAgIU\n-----END CERTIFICATE-----";
const form = (over: Partial<IdpForm>): IdpForm => ({ ...EMPTY_IDP_FORM, name: "Acme", domains: "acme.com", ...over });

const settings = (over: Partial<ClientSsoSettingsOut>): ClientSsoSettingsOut => ({
  client_id: "c1",
  sso_required: false,
  approval_links_allowed: true,
  has_active_idp: false,
  exemption_count: 0,
  warnings: [],
  sign_in_url: "/client/sign-in",
  updated_at: null,
  ...over,
});

describe("client portal sign-in discovery", () => {
  it("keeps the magic link when no IdP matches", () => {
    expect(portalSignInMode(null, false)).toEqual({ showSso: false, showMagicLink: true, showFallbackLink: false, note: null });
    expect(portalSignInMode({ sso: false, idp_id: null, required: false }, false).showSso).toBe(false);
  });

  it("offers company sign-in next to the magic link when optional", () => {
    const mode = portalSignInMode({ sso: true, idp_id: "i1", required: false }, false);
    expect(mode).toMatchObject({ showSso: true, showMagicLink: true, showFallbackLink: false });
  });

  it("hides the magic link when required until \"Can't use company sign-in?\"", () => {
    const required = { sso: true, idp_id: "i1", required: true };
    expect(portalSignInMode(required, false)).toMatchObject({ showSso: true, showMagicLink: false, showFallbackLink: true });
    expect(portalSignInMode(required, false).note).toMatch(/company account/);
    expect(portalSignInMode(required, true)).toMatchObject({ showSso: true, showMagicLink: true, showFallbackLink: false });
  });

  it("discovers only plausible emails with a workspace, keyed on both", () => {
    expect(shouldDiscoverPortal("acme", "a@acme.com")).toBe(true);
    expect(shouldDiscoverPortal(" ", "a@acme.com")).toBe(false);
    expect(shouldDiscoverPortal("acme", "a@acme")).toBe(false);
    expect(discoveryKey(" Acme ", "A@Acme.com ")).toBe(discoveryKey("acme", "a@acme.com"));
    expect(discoveryKey("acme", "a@acme.com")).not.toBe(discoveryKey("acme", "b@acme.com"));
  });

  it("builds the start URL with tenant and next", () => {
    expect(portalSsoStartUrl("idp 1", "acme", "/client/approvals")).toBe(
      "/api/v1/client-portal/auth/sso/idp%201/start?tenant=acme&next=%2Fclient%2Fapprovals",
    );
  });

  it("maps sso_error codes to friendly messages", () => {
    expect(portalSsoErrorMessage("sso_no_client_user")).toBe("Ask your account manager to give you access to the client portal.");
    expect(portalSsoErrorMessage("sso_email_unverified")).toMatch(/did not confirm your email/);
    expect(portalSsoErrorMessage("sso_domain_not_allowed")).toMatch(/domain is not allowed/);
    expect(portalSsoErrorMessage("client_user_inactive")).toMatch(/suspended or revoked/);
    expect(portalSsoErrorMessage("sso_identity_conflict")).toMatch(/different company identity/);
    expect(portalSsoErrorMessage("sso_required")).toBe("Your organisation requires company sign-in.");
    expect(portalSsoErrorMessage("sso_assertion_invalid")).toMatch(/Company sign-in failed/);
    expect(portalSsoErrorMessage("whatever")).toMatch(/Company sign-in failed/);
    expect(portalSsoErrorMessage(undefined)).toBeNull();
  });

  it("parses the mfa param and keeps the sso_required redirect same-origin", () => {
    expect(portalMfaParam("1")).toBe("challenge");
    expect(portalMfaParam("enroll")).toBe("enroll");
    expect(portalMfaParam("x")).toBeNull();
    expect(safeSignInUrl("/client/sign-in?tenant=acme")).toBe("/client/sign-in?tenant=acme");
    expect(safeSignInUrl("//evil.com/x")).toBe("/client/sign-in");
    expect(safeSignInUrl("https://evil.com/client/sign-in", "https://app.talentos.in")).toBe("/client/sign-in");
    expect(safeSignInUrl("https://app.talentos.in/client/sign-in?x=1", "https://app.talentos.in")).toBe("/client/sign-in?x=1");
    expect(safeSignInUrl(undefined)).toBe("/client/sign-in");
  });
});

describe("enforcement card", () => {
  it("disables 'Require SSO' with a tooltip until an IdP is active", () => {
    expect(enforcementState(settings({}), 0)).toMatchObject({
      requireDisabled: true,
      requireTooltip: "Activate an identity provider first",
    });
    expect(enforcementState(settings({ has_active_idp: true }), 0)).toMatchObject({ requireDisabled: false, requireTooltip: null });
    // Turning SSO off stays possible even if the IdP was disabled meanwhile.
    expect(enforcementState(settings({ sso_required: true }), 1).requireDisabled).toBe(false);
    expect(enforcementState(undefined, 0).requireDisabled).toBe(true);
  });

  it("warns when SSO is required without break-glass users", () => {
    expect(enforcementState(settings({ has_active_idp: true, sso_required: true, warnings: ["no_break_glass"] }), 0).showNoBreakGlass).toBe(true);
    expect(enforcementState(settings({ has_active_idp: true, sso_required: true }), 1).showNoBreakGlass).toBe(false);
    expect(enforcementState(settings({ has_active_idp: true }), 0).showNoBreakGlass).toBe(false);
  });

  it("requires an exemption reason of 3..1000 characters", () => {
    expect(validateExemptionReason(" a ")).not.toBeNull();
    expect(validateExemptionReason("IT admin")).toBeNull();
    expect(validateExemptionReason("x".repeat(1001))).not.toBeNull();
  });
});

describe("identity provider form", () => {
  it("requires at least one valid email domain", () => {
    expect(validateSignIn(form({ domains: "" }), PERMS).domains).toMatch(/at least one/);
    expect(validateSignIn(form({ domains: "acme" }), PERMS).domains).toMatch(/Not a valid domain/);
    expect(validateSignIn(form({ domains: "acme.com, @Acme.in" }), PERMS)).toEqual({});
    expect(parseDomains("acme.com, @Acme.in\nacme.com")).toEqual(["acme.com", "acme.in"]);
  });

  it("keeps JIT permissions a non-empty subset of the portal permissions", () => {
    expect(validateSignIn(form({ jitEnabled: true, jitPermissions: [] }), PERMS).jitPermissions).toBeDefined();
    expect(validateSignIn(form({ jitEnabled: true, jitPermissions: ["candidate:delete"] }), PERMS).jitPermissions).toMatch(/Unknown/);
    expect(validateSignIn(form({ jitEnabled: true, jitPermissions: ["invoices:view"] }), PERMS)).toEqual({});
    const body = toCreatePayload(form({ jitEnabled: true, jitPermissions: ["invoices:view", "bogus"] }), PERMS);
    expect(body.jit_default_permissions).toEqual(["invoices:view"]);
    expect(toCreatePayload(form({ jitEnabled: false, jitPermissions: ["invoices:view"] }), PERMS).jit_default_permissions).toEqual([]);
  });

  it("validates the connection per kind and source", () => {
    expect(validateConnection(form({ kind: "oidc", issuer: "http://x.com", clientId: "" }), false)).toMatchObject({
      issuer: expect.stringMatching(/https/),
      clientId: expect.any(String),
    });
    expect(validateConnection(form({ kind: "oidc", issuer: "https://login.acme.com", clientId: "abc" }), false)).toEqual({});
    expect(validateConnection(form({ kind: "saml", entityId: "e", ssoUrl: "https://idp/sso", certs: "" }), false).certs).toBeDefined();
    expect(validateConnection(form({ kind: "saml", entityId: "e", ssoUrl: "https://idp/sso", certs: "" }), true).certs).toBeUndefined();
    expect(validateConnection(form({ kind: "saml", samlSource: "metadata_url", metadataUrl: "https://idp/md" }), false)).toEqual({});
    expect(validateConnection(form({ kind: "saml", samlSource: "metadata_xml", metadataXml: "<x/>" }), false).metadataXml).toBeDefined();
    expect(
      validateConnection(form({ kind: "saml", samlSource: "metadata_xml", metadataXml: '<md:EntityDescriptor entityID="e">' }), false),
    ).toEqual({});
  });

  it("builds create / update / metadata payloads", () => {
    const oidc = toCreatePayload(form({ kind: "oidc", issuer: " https://i ", clientId: "c", clientSecret: "s" }), PERMS);
    expect(oidc).toMatchObject({ kind: "oidc", oidc: { issuer: "https://i", client_id: "c" }, client_secret: "s", email_domains: ["acme.com"] });
    expect(toUpdatePayload(form({ kind: "oidc", issuer: "https://i", clientId: "c" }), PERMS).client_secret).toBeUndefined();

    const saml = toCreatePayload(form({ kind: "saml", entityId: "e", ssoUrl: "https://s", certs: `${CERT}\n${CERT}` }), PERMS);
    expect(saml.saml?.x509_certs).toHaveLength(2);
    expect(saml.saml?.email_attribute).toBeNull();

    const md = form({ kind: "saml", samlSource: "metadata_url", metadataUrl: "https://idp/md" });
    expect(toCreatePayload(md, PERMS).saml).toBeUndefined();
    expect(toMetadataImport(md)).toEqual({ metadata_url: "https://idp/md" });
    expect(toMetadataImport(form({ kind: "saml", samlSource: "metadata_xml", metadataXml: " <x/> " }))).toEqual({ metadata_xml: "<x/>" });
    expect(toMetadataImport(form({ kind: "oidc" }))).toBeNull();
    expect(parseCerts("AAA\n\nBBB")).toEqual(["AAA", "BBB"]);
  });

  it("prefills the edit form from a saved provider", () => {
    const out = {
      id: "i1",
      client_id: "c1",
      name: "Acme",
      kind: "saml",
      status: "draft",
      email_domains: ["acme.com", "acme.in"],
      config: { idp_entity_id: "e", sso_url: "https://s", x509_certs: [CERT] },
      has_secret: false,
      jit_enabled: true,
      jit_default_permissions: ["time:approve"],
      mfa_trusted: false,
      linked_users: 0,
      last_login_at: null,
      redirect_uri: null,
      sp_entity_id: "sp",
      acs_url: "acs",
      warnings: [],
      created_at: "",
      updated_at: "",
    } satisfies ClientIdentityProviderOut;
    expect(idpFormFromOut(out)).toMatchObject({ kind: "saml", entityId: "e", certs: CERT, domains: "acme.com, acme.in", jitPermissions: ["time:approve"] });
  });

  it("maps server errors to messages and fields", () => {
    const taken = new ApiError(409, "sso_domain_taken", "taken", { domains: ["acme.com"] });
    expect(clientSsoErrorMessage(taken)).toMatch(/acme.com/);
    expect(errorField(taken)).toBe("domains");
    expect(clientSsoErrorMessage(new ApiError(422, "sso_config_incomplete", "x", { missing: ["sso_url"] }))).toMatch(/sso_url/);
    expect(clientSsoErrorMessage(new ApiError(409, "client_idp_required", "x"))).toMatch(/Activate an identity provider/);
    expect(errorField(new ApiError(422, "sso_certificate_expired", "x"))).toBe("certs");
    expect(errorField(new ApiError(422, "invalid_portal_permission", "x"))).toBe("jitPermissions");
    expect(clientSsoErrorMessage(new ApiError(500, "internal_error", "boom"))).toMatch(/Something went wrong/);
  });
});
