import { describe, expect, it } from "vitest";
import { NAV_ITEMS, visibleNavItems } from "@/components/app-shell/nav-items";
import { canAccessAdmin, hasAnyPermission, hasPermission } from "./permissions";

describe("hasPermission", () => {
  const perms = { "candidate:read": "team", "user:read": "tenant", "weird:perm": "galaxy" };

  it("grants any known scope when no minimum is given", () => {
    expect(hasPermission(perms, "candidate:read")).toBe(true);
    expect(hasPermission(perms, "user:read")).toBe(true);
  });

  it("denies missing permissions, unknown scopes and empty maps", () => {
    expect(hasPermission(perms, "user:manage")).toBe(false);
    expect(hasPermission(perms, "weird:perm")).toBe(false);
    expect(hasPermission(undefined, "user:read")).toBe(false);
    expect(hasPermission(null, "user:read")).toBe(false);
    expect(hasPermission({}, "user:read")).toBe(false);
  });

  it("compares scopes own < team < bu < tenant", () => {
    expect(hasPermission(perms, "candidate:read", "own")).toBe(true);
    expect(hasPermission(perms, "candidate:read", "team")).toBe(true);
    expect(hasPermission(perms, "candidate:read", "bu")).toBe(false);
    expect(hasPermission(perms, "user:read", "tenant")).toBe(true);
  });

  it("does not match permission prefixes", () => {
    expect(hasPermission({ "user:read": "tenant" }, "user")).toBe(false);
  });
});

describe("admin gating", () => {
  it("opens the admin area for any admin read permission, not role keys", () => {
    expect(canAccessAdmin({ "team:read": "tenant" })).toBe(true);
    expect(canAccessAdmin({ "business_unit:read": "tenant" })).toBe(true);
    expect(canAccessAdmin({ "audit:read": "tenant" })).toBe(true);
    expect(canAccessAdmin({ "settings:manage": "tenant" })).toBe(true);
    expect(canAccessAdmin({ "ai:admin": "tenant" })).toBe(true);
    expect(canAccessAdmin({ "candidate:read": "tenant", "user:manage": "tenant" })).toBe(false);
    expect(canAccessAdmin(undefined)).toBe(false);
    expect(hasAnyPermission({ "a:b": "own" }, ["x:y", "a:b"])).toBe(true);
    expect(hasAnyPermission({ "a:b": "own" }, [])).toBe(false);
  });

  it("shows the Admin nav item only with an admin permission", () => {
    const labels = (p: Record<string, string>) => visibleNavItems(NAV_ITEMS, p).map((i) => i.label);
    expect(labels({})).not.toContain("Admin");
    expect(labels({ "role:read": "tenant" })).toContain("Admin");
    expect(labels({})).toContain("Dashboard");
  });

  it("shows Candidates only with candidate:read", () => {
    const labels = (p: Record<string, string>) => visibleNavItems(NAV_ITEMS, p).map((i) => i.label);
    expect(labels({})).not.toContain("Candidates");
    expect(labels({ "candidate:read": "own" })).toContain("Candidates");
  });
});

describe("Approvals nav item (P2 fix)", () => {
  const approvals = (perms: Record<string, string>) =>
    visibleNavItems(NAV_ITEMS, perms).some((i) => i.href === "/approvals");

  it("is shown to Finance / HR approvers, not only demand and offer approvers", () => {
    expect(approvals({ "timesheet:approve": "tenant" })).toBe(true);
    expect(approvals({ "expense:approve": "tenant" })).toBe(true);
    expect(approvals({ "leave:approve": "team" })).toBe(true);
    expect(approvals({ "worker_bank:approve": "tenant" })).toBe(true);
    expect(approvals({ "demand:approve": "team" })).toBe(true);
  });

  it("stays hidden by permission alone for users with no approval permission", () => {
    expect(approvals({ "candidate:read": "own" })).toBe(false);
  });
});
