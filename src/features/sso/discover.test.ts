import { describe, expect, it } from "vitest";
import { ssoStartUrl } from "./api";
import { loginMode, shouldDiscover, ssoErrorMessage } from "./discover";

describe("SSO discover toggling", () => {
  it("keeps the password form when no IdP matches", () => {
    expect(loginMode(null, false)).toEqual({ showSso: false, showPassword: true, showPasswordLink: false, note: null });
    expect(loginMode({ sso: false, required: false }, false).showSso).toBe(false);
  });

  it("offers SSO next to the password when optional", () => {
    const mode = loginMode({ sso: true, idp_id: "i1", required: false }, false);
    expect(mode.showSso && mode.showPassword).toBe(true);
    expect(mode.showPasswordLink).toBe(false);
  });

  it("hides the password when required but keeps the break-glass link", () => {
    const mode = loginMode({ sso: true, idp_id: "i1", required: true }, false);
    expect(mode).toMatchObject({ showSso: true, showPassword: false, showPasswordLink: true });
    expect(mode.note).toMatch(/single sign-on/);
    expect(loginMode({ sso: true, idp_id: "i1", required: true }, true).showPassword).toBe(true);
  });

  it("discovers only plausible emails with a workspace", () => {
    expect(shouldDiscover("acme", "a@b.co")).toBe(true);
    expect(shouldDiscover("", "a@b.co")).toBe(false);
    expect(shouldDiscover("acme", "a@b")).toBe(false);
  });

  it("builds the start URL and maps callback errors", () => {
    expect(ssoStartUrl("idp 1", "acme", "/candidates")).toBe("/api/v1/auth/sso/idp%201/start?tenant=acme&next=%2Fcandidates");
    expect(ssoErrorMessage("user_deactivated")).toMatch(/deactivated/);
    expect(ssoErrorMessage("weird")).toMatch(/failed/);
    expect(ssoErrorMessage(undefined)).toBeNull();
  });
});
