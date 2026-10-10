import { describe, expect, it } from "vitest";
import { p2Columns } from "../p2/tile-model";
import { maskTile, p3Badges, p3TabKeys, SUPPORTING_SIGNAL, tabHasSupportingSignal } from "./tile-model";
import { isP3Dashboard, P3_DASHBOARD_KEYS, type P3TileOut } from "./types";

const tile = (over: Partial<P3TileOut> = {}): P3TileOut =>
  ({ key: "t", title: "T", kind: "table", status: "ok", computed_at: "2026-10-01T00:00:00Z", ...over }) as P3TileOut;

describe("P3 dashboard tab gating", () => {
  it("shows P3 tabs only for keys the API returned", () => {
    expect(p3TabKeys([{ key: "recruiter" }, { key: "finance" }])).toEqual([]);
    expect(p3TabKeys([{ key: "recruiter" }, { key: "referrals" }, { key: "predictions" }])).toEqual(["referrals", "predictions"]);
  });

  it("recognises the eight Phase 3 keys in API order", () => {
    expect(P3_DASHBOARD_KEYS).toEqual(["marketing", "referrals", "campus", "mobility", "skills", "projects", "immigration", "predictions"]);
    expect(isP3Dashboard("projects")).toBe(true);
    expect(isP3Dashboard("finance")).toBe(false);
    expect(isP3Dashboard(null)).toBe(false);
  });
});

describe("supporting-signal badge", () => {
  it("uses the tile's badge field", () => {
    expect(p3Badges(tile({ badge: SUPPORTING_SIGNAL }), "predictions").map((b) => b.label)).toEqual([SUPPORTING_SIGNAL]);
    expect(p3Badges(tile({ badge: null }), "projects")).toEqual([]);
  });

  it("assumes the badge while a prediction tile loads, never on other dashboards", () => {
    expect(p3Badges(null, "predictions").map((b) => b.label)).toEqual([SUPPORTING_SIGNAL]);
    expect(p3Badges(null, "skills")).toEqual([]);
  });

  it("marks the predictions tab only", () => {
    expect(tabHasSupportingSignal("predictions")).toBe(true);
    expect(tabHasSupportingSignal("projects")).toBe(false);
  });
});

describe("masked money", () => {
  const rows = [{ project: "Apollo", pct_used: "80.00", budget: { amount: "100000.00", currency: "INR" }, burn: { amount: "80000.00", currency: "INR" } }];

  it("strips money columns and headline money from masked tiles and badges them", () => {
    const masked = maskTile(tile({ masked: true, rows, money: { amount: "1.00", currency: "INR" } }));
    expect(masked.money).toBeNull();
    expect(p2Columns(masked.rows ?? []).map((c) => c.key)).toEqual(["project", "pct_used"]);
    expect(p3Badges(masked).map((b) => b.key)).toEqual(["masked"]);
  });

  it("keeps money when the viewer may see it", () => {
    const shown = maskTile(tile({ masked: false, rows }));
    expect(p2Columns(shown.rows ?? []).map((c) => c.kind)).toEqual(["text", "percent", "money", "money"]);
    expect(p3Badges(shown)).toEqual([]);
  });
});
