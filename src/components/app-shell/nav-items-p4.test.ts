import { describe, expect, it } from "vitest";
import { activeNavHref, AI_NAV_GROUP, NAV_ITEMS, visibleNavItems } from "./nav-items";

describe("Phase 4 navigation", () => {
  it("shows Proposals with a counter to deciders and governors", () => {
    const item = NAV_ITEMS.find((i) => i.href === "/proposals");
    expect(item?.counter).toBe("proposals");
    expect(visibleNavItems(NAV_ITEMS, { "proposal:decide": "own" }).some((i) => i.href === "/proposals")).toBe(true);
    expect(visibleNavItems(NAV_ITEMS, { "ai:govern": "tenant" }).some((i) => i.href === "/proposals")).toBe(true);
    expect(visibleNavItems(NAV_ITEMS, {}).some((i) => i.href === "/proposals")).toBe(false);
  });

  it("moves Copilot history into the AI group", () => {
    expect(NAV_ITEMS.some((i) => i.href === "/ai/copilot")).toBe(false);
    expect(AI_NAV_GROUP.items.map((i) => i.label)).toEqual(["Copilot history", "AI governance", "AI agents"]);
    expect(AI_NAV_GROUP.before).toBe("/admin");
    expect(visibleNavItems(AI_NAV_GROUP.items, { "ai:agent_configure": "tenant" }).map((i) => i.href)).toEqual(["/admin/ai/agents"]);
  });

  it("highlights AI group items", () => {
    expect(activeNavHref("/admin/ai/runs/123")).toBe("/admin/ai/runs");
    expect(activeNavHref("/admin/ai/violations")).toBe("/admin/ai/runs");
    expect(activeNavHref("/admin/ai/agents/sourcing")).toBe("/admin/ai/agents");
    expect(activeNavHref("/ai/copilot")).toBe("/ai/copilot");
    expect(activeNavHref("/admin/users")).toBe("/admin");
  });
});
