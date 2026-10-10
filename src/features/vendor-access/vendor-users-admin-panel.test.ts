import { describe, expect, it } from "vitest";
import { togglePermission, VENDOR_PORTAL_PERMISSIONS } from "./vendor-users-admin-panel";

describe("vendor portal access", () => {
  it("lists the five Vendor Portal areas", () => {
    expect(VENDOR_PORTAL_PERMISSIONS.map((p) => p.key)).toEqual([
      "releases:view",
      "submissions:create",
      "placements:view",
      "documents:manage",
      "statements:view",
    ]);
  });

  it("adds a permission in catalogue order without duplicates", () => {
    expect(togglePermission(["statements:view"], "releases:view", true)).toEqual(["releases:view", "statements:view"]);
    expect(togglePermission(["releases:view"], "releases:view", true)).toEqual(["releases:view"]);
  });

  it("removes a permission", () => {
    expect(togglePermission(["releases:view", "placements:view"], "releases:view", false)).toEqual(["placements:view"]);
  });
});
