import { describe, expect, it } from "vitest";
import type { PermissionOut, RoleOut } from "@/lib/api/types";
import {
  buildRoleUpdate,
  groupPermissions,
  groupState,
  moduleAppState,
  moduleCapCount,
  ROLE_KEY_PATTERN,
  roleKeyFromName,
  sameModuleCaps,
  setGrantScope,
  toggleGrant,
  toggleGroup,
  toggleModuleApp,
  toggleModuleCap,
} from "./role-grants";
import type { ModuleAppOut } from "@/lib/api/types";

const ALL = ["own", "team", "bu", "tenant"];
const candRead: PermissionOut = { key: "candidate:read", group: "Candidates", description: "View", scopes: ALL };
const candCreate: PermissionOut = { key: "candidate:create", group: "Candidates", description: "Create", scopes: ALL };
const userRead: PermissionOut = { key: "user:read", group: "Administration", description: "Users", scopes: ["tenant"] };

const role = (over: Partial<RoleOut> = {}): RoleOut => ({
  id: "r1",
  key: "sourcer",
  name: "Sourcer",
  description: null,
  is_system: false,
  is_immutable: false,
  permissions: { "candidate:read": "team" },
  module_caps: {},
  user_count: 0,
  created_at: "2026-09-30T00:00:00Z",
  updated_at: "2026-09-30T00:00:00Z",
  ...over,
});

describe("permission checklist", () => {
  it("groups the catalog preserving order", () => {
    expect(groupPermissions([candRead, userRead, candCreate])).toEqual([
      { group: "Candidates", permissions: [candRead, candCreate] },
      { group: "Administration", permissions: [userRead] },
    ]);
  });

  it("ticks with the narrowest allowed scope and keeps an existing scope", () => {
    expect(toggleGrant({}, candRead, true)).toEqual({ "candidate:read": "own" });
    expect(toggleGrant({}, userRead, true)).toEqual({ "user:read": "tenant" });
    expect(toggleGrant({ "candidate:read": "bu" }, candRead, true)).toEqual({ "candidate:read": "bu" });
    expect(toggleGrant({ "candidate:read": "bu" }, candRead, false)).toEqual({});
  });

  it("rejects scopes the permission does not allow", () => {
    const g = { "user:read": "tenant" };
    expect(setGrantScope(g, userRead, "team")).toBe(g);
    expect(setGrantScope({ "candidate:read": "own" }, candRead, "tenant")).toEqual({ "candidate:read": "tenant" });
  });

  it("toggles whole groups and reports mixed state", () => {
    const perms = [candRead, candCreate];
    expect(groupState({}, perms)).toBe(false);
    expect(groupState({ "candidate:read": "own" }, perms)).toBe("mixed");
    const all = toggleGroup({ "candidate:read": "bu" }, perms, true);
    expect(all).toEqual({ "candidate:read": "bu", "candidate:create": "own" });
    expect(groupState(all, perms)).toBe(true);
    expect(toggleGroup(all, perms, false)).toEqual({});
  });
});

describe("roleKeyFromName", () => {
  it("derives valid keys", () => {
    expect(roleKeyFromName("Senior Recruiter")).toBe("senior_recruiter");
    expect(roleKeyFromName("  Café  Manager! ")).toBe("cafe_manager");
    expect(roleKeyFromName("123 Ops")).toBe("ops");
    expect(roleKeyFromName("A")).toBe("a_role");
    for (const name of ["Senior Recruiter", "x".repeat(100), "A"]) {
      expect(roleKeyFromName(name)).toMatch(ROLE_KEY_PATTERN);
    }
    expect(roleKeyFromName("!!!")).toBe("");
  });
});

describe("buildRoleUpdate", () => {
  const draft = {
    key: "sourcer",
    name: "Sourcer",
    description: "",
    permissions: { "candidate:read": "team" },
    moduleCaps: {},
  };

  it("is empty when nothing changed", () => {
    expect(buildRoleUpdate(role(), draft)).toEqual({});
  });

  it("sends only changed fields", () => {
    expect(
      buildRoleUpdate(role(), {
        ...draft,
        name: " Lead Sourcer ",
        description: " finds people ",
        permissions: { "candidate:read": "tenant" },
      }),
    ).toEqual({ name: "Lead Sourcer", description: "finds people", permissions: { "candidate:read": "tenant" } });
  });

  it("clears the description with null", () => {
    expect(buildRoleUpdate(role({ description: "old" }), draft)).toEqual({ description: null });
  });

  it("never sends the key of a system role or grants of an immutable one", () => {
    expect(buildRoleUpdate(role({ is_system: true }), { ...draft, key: "other" })).toEqual({});
    expect(
      buildRoleUpdate(role({ is_system: true, is_immutable: true }), { ...draft, permissions: {} }),
    ).toEqual({});
    expect(buildRoleUpdate(role(), { ...draft, key: "hunter" })).toEqual({ key: "hunter" });
  });

  it("sends module_caps only when they changed (never for an immutable role)", () => {
    expect(buildRoleUpdate(role(), { ...draft, moduleCaps: { croar: ["sourcing"] } })).toEqual({
      module_caps: { croar: ["sourcing"] },
    });
    expect(buildRoleUpdate(role({ module_caps: { croar: ["sourcing"] } }), draft)).toEqual({ module_caps: {} });
    expect(
      buildRoleUpdate(role({ is_system: true, is_immutable: true }), { ...draft, moduleCaps: { croar: ["pilot"] } }),
    ).toEqual({});
  });
});

describe("module capabilities", () => {
  const croar: ModuleAppOut = {
    key: "croar",
    label: "Croar",
    description: "",
    capabilities: [
      { key: "pilot", label: "Pilot", description: "" },
      { key: "sourcing", label: "Sourcing", description: "" },
    ],
  };

  it("toggles a single capability and drops empty apps", () => {
    expect(toggleModuleCap({}, "croar", "sourcing", true)).toEqual({ croar: ["sourcing"] });
    expect(toggleModuleCap({ croar: ["sourcing"] }, "croar", "sourcing", false)).toEqual({});
  });

  it("toggles a whole app and reports state", () => {
    expect(toggleModuleApp({}, croar, true)).toEqual({ croar: ["pilot", "sourcing"] });
    expect(toggleModuleApp({ croar: ["pilot"] }, croar, false)).toEqual({});
    expect(moduleAppState({}, croar)).toBe(false);
    expect(moduleAppState({ croar: ["pilot"] }, croar)).toBe("mixed");
    expect(moduleAppState({ croar: ["pilot", "sourcing"] }, croar)).toBe(true);
  });

  it("counts caps and compares maps ignoring order", () => {
    expect(moduleCapCount({ croar: ["pilot", "sourcing"], portal: ["jobs"] })).toBe(3);
    expect(sameModuleCaps({ croar: ["pilot", "sourcing"] }, { croar: ["sourcing", "pilot"] })).toBe(true);
    expect(sameModuleCaps({ croar: ["pilot"] }, { croar: ["sourcing"] })).toBe(false);
    expect(sameModuleCaps({}, { croar: ["pilot"] })).toBe(false);
  });
});
