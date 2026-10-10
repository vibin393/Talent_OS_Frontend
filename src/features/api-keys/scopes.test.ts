import { describe, expect, it } from "vitest";
import { canCloseShowOnce, delegableScopes, groupScopes, groupState, maskedKey, NON_DELEGABLE_SCOPES } from "./scopes";

describe("non-delegable scope filter", () => {
  const held = {
    "candidate:read": "tenant",
    "candidate:write": "own",
    "api_key:manage": "tenant",
    "dsr:process": "tenant",
    "settings:manage": "tenant",
    "client:read": "team",
  };
  it("hides non-delegable scopes and scopes the creator lacks", () => {
    expect(delegableScopes(held)).toEqual(["candidate:read", "candidate:write", "client:read"]);
    for (const s of delegableScopes(held)) expect(NON_DELEGABLE_SCOPES.has(s)).toBe(false);
  });
  it("intersects with the server list when loaded", () => {
    expect(delegableScopes(held, ["candidate:read", "demand:read", "api_key:manage"])).toEqual(["candidate:read"]);
    expect(delegableScopes(null)).toEqual([]);
  });
});

describe("scope tree", () => {
  it("groups by resource", () => {
    const groups = groupScopes(["candidate:write", "client:read", "candidate:read"]);
    expect(groups).toEqual([
      { resource: "candidate", label: "Candidates", scopes: ["candidate:read", "candidate:write"] },
      { resource: "client", label: "Clients", scopes: ["client:read"] },
    ]);
    expect(groupState(groups[0], new Set(["candidate:read"]))).toBe("mixed");
    expect(groupState(groups[0], new Set(["candidate:read", "candidate:write"]))).toBe(true);
    expect(groupState(groups[1], new Set())).toBe(false);
  });
});

describe("show-once key flow", () => {
  it("masks stored keys and closes only after acknowledgement", () => {
    expect(maskedKey("ab12cd34")).toBe("tos_ab12cd34…");
    expect(canCloseShowOnce(false)).toBe(false);
    expect(canCloseShowOnce(true)).toBe(true);
  });
});
