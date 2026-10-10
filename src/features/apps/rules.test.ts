import { describe, expect, it } from "vitest";
import { consentStateMessage, publisherBadge, redirectUriError, scopeReasonError, statusLabel } from "./rules";

describe("redirect URI rules", () => {
  it("accepts https and loopback http with a port for public clients", () => {
    expect(redirectUriError("https://a.example/cb", "confidential")).toBeNull();
    expect(redirectUriError("http://127.0.0.1:8123/cb", "public")).toBeNull();
    expect(redirectUriError("http://localhost:9000/cb", "public")).toBeNull();
  });
  it("refuses http, wildcards, fragments and loopback for server-side apps", () => {
    expect(redirectUriError("http://a.example/cb", "confidential")).not.toBeNull();
    expect(redirectUriError("http://127.0.0.1:8123/cb", "confidential")).not.toBeNull();
    expect(redirectUriError("http://localhost/cb", "public")).not.toBeNull();
    expect(redirectUriError("https://a.example/cb#x", "confidential")).not.toBeNull();
    expect(redirectUriError("https://*.example/cb", "confidential")).not.toBeNull();
  });
});

describe("scope reasons and copy", () => {
  it("requires 10-300 characters", () => {
    expect(scopeReasonError("short")).not.toBeNull();
    expect(scopeReasonError("Syncs candidates nightly")).toBeNull();
  });
  it("has a message for every blocking consent state", () => {
    expect(consentStateMessage("app_not_installed", "Acme")).toContain("Acme isn't set up");
    expect(consentStateMessage("needs_admin_approval", "Acme")).toContain("administrator");
    expect(consentStateMessage("mcp_disabled", "Acme")).toContain("AI assistant access");
    expect(consentStateMessage("invalid", "Acme")).toContain("This link isn't valid");
    expect(consentStateMessage("ok", "Acme")).toBeNull();
  });
  it("labels publishers and statuses", () => {
    expect(publisherBadge("tenant", false, "Initech")).toBe("Private app — Initech");
    expect(publisherBadge("partner", true, "")).toBe("Verified partner");
    expect(statusLabel("development")).toBe("In development");
  });
});
