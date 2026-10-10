import { describe, expect, it } from "vitest";
import type { PermissionOut } from "@/lib/api/types";
import { toggleGroup } from "./role-grants";

const perm = (key: string, sensitive = false): PermissionOut => ({
  key,
  group: "Finance",
  description: key,
  scopes: ["tenant"],
  sensitive,
});

describe("FR-81 sensitive permissions in the role editor", () => {
  it("ticking a group never adds sensitive permissions; unticking removes them", () => {
    const perms = [perm("legal_entity:read"), perm("invoice:issue", true)];
    const ticked = toggleGroup({}, perms, true);
    expect(ticked).toEqual({ "legal_entity:read": "tenant" });
    expect(toggleGroup({ "legal_entity:read": "tenant", "invoice:issue": "tenant" }, perms, false)).toEqual({});
  });
});
