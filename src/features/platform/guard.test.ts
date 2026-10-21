import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { OperatorOut } from "@/lib/api/types";
import { daysUntil, incidentHoursLeft, needsEmergencyOverride } from "./errors";
import { PLATFORM_HOME, platformGuard, platformLoginUrl, safePlatformNext } from "./guard";

const op = (mfa: boolean, mfaEnforced = true): OperatorOut => ({
  id: "o",
  email: "ops@x.test",
  name: "Ops",
  mfa_enabled: mfa,
  last_login_at: null,
  mfa_enforced: mfaEnforced,
});

describe("platform route guard", () => {
  it("sends signed-out operators to the platform login", () => {
    expect(platformGuard({ mePending: false, me: undefined, meError: new ApiError(401, "unauthorized", "x") })).toBe("login");
    expect(platformGuard({ mePending: false, me: undefined, meError: new ApiError(500, "internal_error", "x") })).toBe("error");
  });
  it("waits while loading", () => {
    expect(platformGuard({ mePending: true, me: undefined, meError: null })).toBe("loading");
  });
  it("forces MFA enrolment for operators without a second factor where MFA is enforced", () => {
    expect(platformGuard({ mePending: false, me: op(false), meError: null })).toBe("enroll");
    expect(platformGuard({ mePending: false, me: op(true), meError: null })).toBe("ready");
  });
  it("lets an unenrolled operator in when MFA is not enforced (local development)", () => {
    expect(platformGuard({ mePending: false, me: op(false, false), meError: null })).toBe("ready");
    expect(platformGuard({ mePending: false, me: op(true, false), meError: null })).toBe("ready");
  });
});

describe("platform next path", () => {
  it("only allows console paths", () => {
    expect(safePlatformNext("/platform/tenants/1?x=1")).toBe("/platform/tenants/1?x=1");
    expect(safePlatformNext("/dashboard")).toBe(PLATFORM_HOME);
    expect(safePlatformNext("//evil.test/platform")).toBe(PLATFORM_HOME);
    expect(safePlatformNext("/platform/login")).toBe(PLATFORM_HOME);
    expect(safePlatformNext("/platformx")).toBe(PLATFORM_HOME);
    expect(safePlatformNext("/platform/../dashboard")).toBe(PLATFORM_HOME);
    expect(platformLoginUrl("/platform/incidents")).toBe("/platform/login?next=%2Fplatform%2Fincidents");
    expect(platformLoginUrl()).toBe("/platform/login");
  });
});

describe("platform helpers", () => {
  const now = new Date("2026-10-01T00:00:00Z");
  it("applies the 30-day sub-processor rule", () => {
    expect(needsEmergencyOverride("2026-10-11", now)).toBe(true);
    expect(needsEmergencyOverride("2026-11-15", now)).toBe(false);
  });
  it("counts offboarding days and incident hours", () => {
    expect(daysUntil("2026-10-31T00:00:00Z", now)).toBe(30);
    expect(daysUntil("2026-09-01T00:00:00Z", now)).toBe(0);
    expect(incidentHoursLeft("2026-09-30T06:00:00Z", now)).toBe(6);
    expect(incidentHoursLeft("2026-09-29T00:00:00Z", now)).toBeLessThan(0);
  });
});
