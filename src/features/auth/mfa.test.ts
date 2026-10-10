import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { AuthOut } from "@/lib/api/types";
import {
  formatSecret,
  isChallengeExpired,
  isCompleteTotp,
  isMfaChallenge,
  mfaErrorMessage,
  normalizeRecoveryCode,
  normalizeTotpInput,
  recoveryCodesFileName,
  recoveryCodesText,
} from "./mfa";

describe("isMfaChallenge", () => {
  it("distinguishes the challenge from a session", () => {
    expect(isMfaChallenge({ mfa_required: true })).toBe(true);
    expect(isMfaChallenge({ user: {}, tenant: {}, permissions: {} } as unknown as AuthOut)).toBe(false);
    expect(isMfaChallenge(null)).toBe(false);
  });
});

describe("code input", () => {
  it("keeps up to six digits", () => {
    expect(normalizeTotpInput("123 456")).toBe("123456");
    expect(normalizeTotpInput("12a-34b5678")).toBe("123456");
    expect(isCompleteTotp("123456")).toBe(true);
    expect(isCompleteTotp("12345")).toBe(false);
    expect(normalizeRecoveryCode(" abcd-efgh ")).toBe("ABCD-EFGH");
  });

  it("groups the secret for manual entry", () => {
    expect(formatSecret("JBSWY3DPEHPK3PXPAB")).toBe("JBSW Y3DP EHPK 3PXP AB");
    expect(formatSecret("")).toBe("");
  });
});

describe("recovery codes file", () => {
  it("lists every code with context", () => {
    const text = recoveryCodesText(["AAAA-BBBB", "CCCC-DDDD"], {
      workspace: "acme",
      email: "ann@acme.com",
      generatedAt: new Date("2026-09-30T00:00:00Z"),
    });
    expect(text).toContain("Workspace: acme");
    expect(text).toContain("Account: ann@acme.com");
    expect(text).toContain("Generated: 2026-09-30T00:00:00.000Z");
    expect(text).toContain(" 1. AAAA-BBBB");
    expect(text).toContain(" 2. CCCC-DDDD");
    expect(text.endsWith("\n")).toBe(true);
  });

  it("builds a safe file name", () => {
    expect(recoveryCodesFileName("Acme Corp")).toBe("talent-os-recovery-codes-acme-corp.txt");
    expect(recoveryCodesFileName()).toBe("talent-os-recovery-codes.txt");
    expect(recoveryCodesFileName("../..")).toBe("talent-os-recovery-codes.txt");
  });
});

describe("mfaErrorMessage", () => {
  it("maps the MFA error codes", () => {
    expect(mfaErrorMessage(new ApiError(401, "invalid_code", "x"))).toMatch(/didn't work/);
    expect(mfaErrorMessage(new ApiError(401, "invalid_code", "x"), { recoveryCode: true })).toMatch(/recovery code/);
    expect(mfaErrorMessage(new ApiError(409, "mfa_required_by_tenant", "x"))).toMatch(/cannot be turned off/);
    expect(mfaErrorMessage(new ApiError(422, "validation_error", "x"))).toMatch(/6-digit/);
    expect(mfaErrorMessage(new ApiError(0, "network_error", "x"))).toMatch(/Cannot reach/);
  });

  it("detects an expired challenge", () => {
    expect(isChallengeExpired(new ApiError(401, "mfa_challenge_expired", "x"))).toBe(true);
    expect(isChallengeExpired(new ApiError(401, "invalid_code", "x"))).toBe(false);
  });
});

describe("admin Security section", () => {
  it("is visible with settings:read and opens the admin area", async () => {
    const { visibleAdminSections } = await import("@/features/admin/sections");
    const { canAccessAdmin } = await import("./permissions");
    expect(visibleAdminSections({ "settings:read": "tenant" }).map((s) => s.label)).toEqual(["Security"]);
    expect(canAccessAdmin({ "settings:read": "tenant" })).toBe(true);
  });
});
