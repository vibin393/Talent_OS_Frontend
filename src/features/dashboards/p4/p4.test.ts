import { describe, expect, it } from "vitest";
import type { P2TileOut } from "../p2/types";
import { agentQuery, isLinkOnlyTile, isTabVisible, linkOnlyHref, p4Badges, p4TabKeys, usdTile } from "./tile-model";

const tile = (over: Partial<P2TileOut> = {}): P2TileOut =>
  ({ key: "t", title: "T", kind: "kpi", status: "ok", computed_at: "2026-10-01T00:00:00Z", value: 1, ...over }) as P2TileOut;

describe("P4 dashboard tab gating", () => {
  it("shows P4 tabs only when listed and permitted", () => {
    const listed = [{ key: "recruiter" }, { key: "agents" }, { key: "agent_outcomes" }];
    expect(p4TabKeys(listed, { "report:read": "tenant" })).toEqual(["agent_outcomes"]);
    expect(p4TabKeys(listed, { "report:read": "tenant", "ai:govern": "tenant" })).toEqual(["agents", "agent_outcomes"]);
    expect(p4TabKeys([{ key: "recruiter" }], { "ai:govern": "tenant" })).toEqual([]);
    expect(isTabVisible("recruiter", {})).toBe(true);
  });

  it("passes the agent filter as agent_key", () => {
    expect(agentQuery("sourcing")).toBe("agent_key=sourcing");
    expect(agentQuery(null)).toBe("");
  });
});

describe("Estimate badge", () => {
  it("labels SM-30 tiles", () => {
    expect(p4Badges("sm30_coordination_time", null).map((b) => b.label)).toEqual(["Estimate"]);
    expect(p4Badges("x", tile({ estimate: true })).map((b) => b.label)).toEqual(["Estimate"]);
    expect(p4Badges("x", tile())).toEqual([]);
  });
});

describe("link-only SM-C16", () => {
  it("is a link card without numbers", () => {
    expect(isLinkOnlyTile("smc16_impact_ratios", null)).toBe(true);
    expect(isLinkOnlyTile("other", tile({ value: null, link: { path: "/fairness", query: {} } }))).toBe(true);
    expect(isLinkOnlyTile("other", tile())).toBe(false);
    expect(linkOnlyHref({ path: "/fairness", query: {} })).toBe("/fairness");
    expect(linkOnlyHref(null)).toBe("/fairness");
    expect(linkOnlyHref({ path: "//evil", query: {} })).toBe("/fairness");
  });
});

describe("USD cost", () => {
  it("formats money and cost columns as USD with 2 decimals", () => {
    const out = usdTile(tile({ money: { amount: "12.345", currency: "USD" }, rows: [{ agent: "Sourcing", cost_usd: "0.5", runs: 3 }] }));
    expect(out.headline).toBe("$12.35");
    expect(out.tile.money).toBeNull();
    expect(out.tile.rows?.[0]).toEqual({ agent: "Sourcing", cost_usd: "$0.50", runs: 3 });
  });
});
