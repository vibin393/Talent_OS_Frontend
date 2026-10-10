import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { AdminUserOut } from "@/lib/api/types";
import { adminErrorMessage } from "./errors";
import { activeAdminHref, visibleAdminSections } from "./sections";
import { buildUserUpdate, isEmptyUpdate, sameIdSet, userDraft } from "./user-update";

const user: AdminUserOut = {
  id: "u1",
  email: "ann@x.io",
  name: "Ann",
  is_active: true,
  role_keys: ["recruiter"],
  roles: [{ id: "r1", key: "recruiter", name: "Recruiter" }],
  business_unit: { id: "b1", name: "North" },
  teams: [
    { id: "t1", name: "Alpha", is_lead: false },
    { id: "t2", name: "Beta", is_lead: true },
  ],
  mfa_enabled: false,
  last_login_at: null,
  created_at: "2026-09-30T00:00:00Z",
};
const all = { teams: true, businessUnit: true };

describe("buildUserUpdate", () => {
  it("is empty for an untouched draft (team order does not matter)", () => {
    const draft = { ...userDraft(user), teamIds: ["t2", "t1"] };
    expect(isEmptyUpdate(buildUserUpdate(user, draft, all))).toBe(true);
  });

  it("sends changed fields only", () => {
    const body = buildUserUpdate(
      user,
      { name: " Ann Lee ", roleIds: ["r1", "r2"], businessUnitId: null, teamIds: ["t1"] },
      all,
    );
    expect(body).toEqual({ name: "Ann Lee", role_ids: ["r1", "r2"], business_unit_id: null, team_ids: ["t1"] });
  });

  it("omits teams / business unit without the rights (e.g. editing oneself)", () => {
    const body = buildUserUpdate(
      user,
      { ...userDraft(user), businessUnitId: "b2", teamIds: [] },
      { teams: false, businessUnit: false },
    );
    expect(body).toEqual({});
  });

  it("never sends a blank name and allows removing all roles", () => {
    expect(buildUserUpdate(user, { ...userDraft(user), name: "  ", roleIds: [] }, all)).toEqual({ role_ids: [] });
  });

  it("compares id sets ignoring order and duplicates", () => {
    expect(sameIdSet(["a", "b"], ["b", "a"])).toBe(true);
    expect(sameIdSet(["a", "a"], ["a"])).toBe(true);
    expect(sameIdSet(["a"], ["a", "b"])).toBe(false);
  });
});

describe("adminErrorMessage", () => {
  it("maps admin error codes", () => {
    expect(adminErrorMessage(new ApiError(409, "last_admin", "x"))).toMatch(/at least one active Tenant Admin/);
    expect(adminErrorMessage(new ApiError(409, "seat_limit_reached", "x"))).toMatch(/seats/);
    expect(adminErrorMessage(new ApiError(403, "forbidden", "x", { permission: "role:manage" }))).toBe(
      'You need the "role:manage" permission to do this.',
    );
    expect(adminErrorMessage(new ApiError(404, "not_found", "x"))).toMatch(/no longer exists/);
    expect(adminErrorMessage(new ApiError(400, "something_else", "Server says no"))).toBe("Server says no");
    expect(adminErrorMessage(new Error("boom"))).toMatch(/Something went wrong/);
  });
});

describe("admin sections", () => {
  it("lists only the sections the user may open", () => {
    expect(visibleAdminSections({ "team:read": "tenant" }).map((s) => s.label)).toEqual(["Teams"]);
    expect(visibleAdminSections({ "user:read": "tenant" }).map((s) => s.label)).toEqual([
      "Users",
      "Pending invitations",
    ]);
    expect(visibleAdminSections({ "audit:read": "tenant" }).map((s) => s.label)).toEqual(["Audit log"]);
    const settingsLabels = visibleAdminSections({ "settings:manage": "tenant", "ai:admin": "tenant" }).map((s) => s.label);
    expect(settingsLabels).toEqual(expect.arrayContaining(["Skill catalog", "Approval chains", "SLAs"]));
    expect(settingsLabels).not.toContain("Users");
    expect(visibleAdminSections(undefined)).toEqual([]);
  });

  it("finds the active tab", () => {
    expect(activeAdminHref("/admin")).toBe("/admin");
    expect(activeAdminHref("/admin/roles")).toBe("/admin/roles");
    expect(activeAdminHref("/admin/users/123")).toBe("/admin/users");
    expect(activeAdminHref("/admin/usersx")).toBe("/admin");
    expect(activeAdminHref("/admin/audit-log")).toBe("/admin/audit-log");
  });
});
