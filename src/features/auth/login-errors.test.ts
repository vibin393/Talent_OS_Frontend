import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { formatLockedUntil, loginErrorMessage } from "./login-errors";

describe("loginErrorMessage", () => {
  it("shows the unlock time for a locked account", () => {
    const until = "2026-09-30T10:15:00Z";
    const msg = loginErrorMessage(new ApiError(401, "account_locked", "Locked", { locked_until: until }));
    expect(msg).toBe(`Too many failed attempts. Your account is locked until ${formatLockedUntil(until)}.`);
  });

  it("handles a locked account with an invalid or missing locked_until", () => {
    const generic = "Too many failed attempts. Your account is temporarily locked.";
    expect(loginErrorMessage(new ApiError(401, "account_locked", "Locked", { locked_until: "not-a-date" }))).toBe(
      generic,
    );
    expect(loginErrorMessage(new ApiError(401, "account_locked", "Locked"))).toBe(generic);
  });

  it("explains mfa_required", () => {
    expect(loginErrorMessage(new ApiError(401, "mfa_required", "MFA"))).toMatch(/multi-factor authentication/);
  });

  it("uses one message for invalid credentials", () => {
    expect(loginErrorMessage(new ApiError(401, "invalid_credentials", "Invalid email or password"))).toBe(
      "Incorrect workspace, email or password",
    );
  });

  it("handles rate limiting and network failures", () => {
    expect(loginErrorMessage(new ApiError(429, "rate_limited", "Too many"))).toMatch(/Too many sign-in attempts/);
    expect(loginErrorMessage(new ApiError(0, "network_error", "x"))).toMatch(/Cannot reach the server/);
  });
});

describe("formatLockedUntil", () => {
  it("returns null for non-dates", () => {
    expect(formatLockedUntil(undefined)).toBeNull();
    expect(formatLockedUntil(42)).toBeNull();
    expect(formatLockedUntil("garbage")).toBeNull();
  });
});
