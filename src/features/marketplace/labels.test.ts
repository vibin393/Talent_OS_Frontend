import { describe, expect, it } from "vitest";
import {
  configureComplete,
  installStateBadge,
  listingAction,
  policyWarning,
  reviewAccessComplete,
  schemaFields,
  secretCaption,
  STATUS_LABELS,
  uninstallErasureCaption,
  wizardSteps,
} from "./labels";

describe("marketplace labels", () => {
  it("maps install states to badges", () => {
    expect(installStateBadge("installed")).toEqual({ label: "Installed", color: "success" });
    expect(installStateBadge("configured")?.label).toBe("Configured");
    expect(installStateBadge("degraded")).toEqual({ label: "Needs attention", color: "danger" });
    expect(installStateBadge("not_installed")).toBeNull();
    expect(STATUS_LABELS.reconsent_required.label).toBe("Re-consent required");
  });

  it("chooses the listing action", () => {
    const base = { kind: "connector" as const, install_state: "not_installed" as const, install_allowed: true, manage_path: null };
    expect(listingAction(base, true)).toEqual({ kind: "install", disabledReason: null });
    expect(listingAction(base, false)).toEqual({ kind: "install", disabledReason: "You need the Manage integrations permission" });
    expect(listingAction({ ...base, install_allowed: false }, true)).toEqual({ kind: "install", disabledReason: "Not allowed by your app policy" });
    expect(listingAction({ ...base, install_state: "installed" }, true)).toEqual({ kind: "manage" });
    expect(listingAction({ ...base, kind: "legacy_connector", manage_path: "/admin/payroll" }, true)).toEqual({ kind: "open", href: "/admin/payroll" });
  });

  it("gates the review-access step on consent and sensitive purposes", () => {
    const scopes = [
      { key: "candidates:read", reason: "Sync", sensitive: false },
      { key: "pii.identity:read", reason: "Verify", sensitive: true },
    ];
    expect(reviewAccessComplete(scopes, {}, true)).toBe(false);
    expect(reviewAccessComplete(scopes, { "pii.identity:read": "short" }, true)).toBe(false);
    expect(reviewAccessComplete(scopes, { "pii.identity:read": "We verify identity documents." }, false)).toBe(false);
    expect(reviewAccessComplete(scopes, { "pii.identity:read": "We verify identity documents." }, true)).toBe(true);
    expect(wizardSteps("app")).toEqual(["Review access", "Configure", "Finish"]);
    expect(wizardSteps("connector")).toContain("Test");
  });

  it("builds the configuration form from the manifest schema", () => {
    const fields = schemaFields({
      properties: {
        account_id: { type: "string", title: "Account ID", description: "From your employer portal" },
        region: { type: "string", enum: ["in", "sg"] },
        sandbox: { type: "boolean" },
        mode: { type: "string" },
      },
      required: ["account_id"],
    });
    expect(fields.map((f) => [f.name, f.kind, f.label])).toEqual([
      ["account_id", "text", "Account ID"],
      ["region", "select", "Region"],
      ["sandbox", "boolean", "Sandbox"],
    ]);
    expect(fields[0].help).toBe("From your employer portal");
    expect(configureComplete(fields, {}, ["api_key"], { api_key: "x" })).toBe(false);
    expect(configureComplete(fields, { account_id: "A1" }, ["api_key"], {})).toBe(false);
    expect(configureComplete(fields, { account_id: "A1" }, ["api_key"], { api_key: "x" })).toBe(true);
  });

  it("never shows a secret value and words the uninstall / policy variants", () => {
    expect(secretCaption("1a2b", null)).toBe("Saved · ends in 1a2b · changed —");
    expect(uninstallErasureCaption("Naukri", true)).toBeNull();
    expect(uninstallErasureCaption("Naukri", false)).toBe("Naukri can't receive deletion requests from Talent OS. Contact them directly.");
    expect(policyWarning(0)).toBeNull();
    expect(policyWarning(1)).toBe("1 installed app is no longer allowed by this policy. They keep running until you uninstall them.");
  });
});
