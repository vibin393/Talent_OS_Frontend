import { describe, expect, it } from "vitest";
import { bucketHref, crmTileHref, monthRange } from "./links";
import { chartRows, currenciesOf, seriesFor } from "./series";

describe("sales dashboard tile links", () => {
  it("keeps the tile filters in the link", () => {
    const link = "/opportunities?view=list&close_from=2026-10-01&close_to=2026-10-31&owner_id=u1";
    expect(crmTileHref(link)).toBe(link);
    expect(crmTileHref("/leads?source=referral&created_from=2026-07-01")).toBe("/leads?source=referral&created_from=2026-07-01");
  });

  it("rejects unknown or external routes", () => {
    expect(crmTileHref("https://evil.example/x")).toBeNull();
    expect(crmTileHref("//evil.example")).toBeNull();
    expect(crmTileHref("/nowhere?x=1")).toBeNull();
    expect(crmTileHref(null)).toBeNull();
  });

  it("adds bucket filters on top of the tile filters", () => {
    const href = bucketHref("/opportunities?owner_id=u1&stage=proposal", { stage: "negotiation" });
    const url = new URL(href!, "http://x");
    expect(url.pathname).toBe("/opportunities");
    expect(url.searchParams.get("owner_id")).toBe("u1");
    expect(url.searchParams.get("stage")).toBe("negotiation");
    const m = monthRange("2026-02")!;
    expect(bucketHref("/opportunities?owner_id=u1", { close_from: m.from, close_to: m.to })).toBe(
      "/opportunities?owner_id=u1&close_from=2026-02-01&close_to=2026-02-28",
    );
  });

  it("builds one series per currency", () => {
    const buckets = [
      { key: "proposal", label: "Proposal", count: 2, totals: [{ currency: "INR", estimated: "100.00", weighted: "40.00" }] },
      { key: "negotiation", label: "Negotiation", count: 1, totals: [{ currency: "USD", estimated: "10", weighted: "6" }] },
    ];
    const cur = currenciesOf(buckets);
    expect(cur).toEqual(["INR", "USD"]);
    const series = seriesFor(cur, ["weighted"]);
    expect(series.map((s) => s.key)).toEqual(["INR_weighted", "USD_weighted"]);
    const rows = chartRows(buckets, series);
    expect(rows[0]).toMatchObject({ INR_weighted: 40, USD_weighted: 0 });
    expect(rows[1]).toMatchObject({ INR_weighted: 0, USD_weighted: 6 });
  });
});
