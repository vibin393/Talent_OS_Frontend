import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FluentProvider, tokens, webLightTheme } from "@fluentui/react-components";
import type { TileDefOut, TileOut } from "@/lib/api/types";
import { AXIS_TICK, GRID_COLOR, SERIES_COLORS, seriesColor, seriesDash, TOOLTIP_SURFACE } from "./chart-theme";
import { ChartTile } from "./chart-tile";
import {
  dashboardParamsToSearch,
  parseDashboardParams,
  presetRange,
  rangeError,
  resolveRange,
  tileQuery,
  todayIn,
} from "./date-range";
import { KpiTile } from "./kpi-tile";
import { bucketLink, isKnownRoute, rowHref, tileHref } from "./links";
import { TableTile } from "./table-tile";
import { isTileVisible, TileCard, tileSpan } from "./tile-card";
import { barData, barLabel, kpiItems, parseSeries, sampleNote, seriesRows, tableColumns } from "./tile-format";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard",
}));

function render(el: ReactElement): string {
  return renderToStaticMarkup(createElement(FluentProvider, { theme: webLightTheme }, el));
}

const base: Omit<TileOut, "key" | "kind" | "title"> = { status: "ok", computed_at: "2026-09-30T05:12:00Z" };

describe("date presets", () => {
  // 2026-09-30 20:00 UTC is already 1 Oct in IST (UTC+5:30).
  const now = new Date("2026-09-30T20:00:00Z");

  it("resolves today in the user's timezone", () => {
    expect(todayIn("Asia/Kolkata", now)).toBe("2026-10-01");
    expect(todayIn("UTC", now)).toBe("2026-09-30");
    expect(todayIn("Not/AZone", new Date("2026-09-30T12:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("computes from/to for each preset", () => {
    expect(presetRange("today", "Asia/Kolkata", now)).toEqual({ from: "2026-10-01", to: "2026-10-01" });
    expect(presetRange("last_7", "UTC", now)).toEqual({ from: "2026-09-24", to: "2026-09-30" });
    expect(presetRange("last_30", "UTC", now)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(presetRange("last_90", "UTC", now)).toEqual({ from: "2026-07-03", to: "2026-09-30" });
    // 30 Sep 2026 is a Wednesday; 1 Oct (IST) a Thursday -> both weeks start Monday 28 Sep.
    expect(presetRange("this_week", "UTC", now)).toEqual({ from: "2026-09-28", to: "2026-09-30" });
    expect(presetRange("this_week", "Asia/Kolkata", now)).toEqual({ from: "2026-09-28", to: "2026-10-01" });
    expect(presetRange("this_quarter", "UTC", now)).toEqual({ from: "2026-07-01", to: "2026-09-30" });
    expect(presetRange("this_quarter", "Asia/Kolkata", now)).toEqual({ from: "2026-10-01", to: "2026-10-01" });
  });

  it("validates custom ranges", () => {
    expect(rangeError({ from: "2026-01-01", to: "2026-09-30" })).toBeNull();
    expect(rangeError({ from: "2026-09-30", to: "2026-09-01" })).toMatch(/on or before/);
    expect(rangeError({ from: "2025-01-01", to: "2026-09-30" })).toMatch(/366/);
    expect(rangeError({ from: "2026-02-30", to: "2026-03-01" })).toMatch(/Pick a start/);
  });

  it("round-trips dashboard state through the URL", () => {
    const p = parseDashboardParams(
      new URLSearchParams("view=manager&range=custom&from=2026-07-01&to=2026-09-30&bu=0f6cbd00-0000-4000-8000-000000000001"),
    );
    expect(p).toEqual({
      view: "manager",
      preset: "custom",
      from: "2026-07-01",
      to: "2026-09-30",
      businessUnitIds: ["0f6cbd00-0000-4000-8000-000000000001"],
    });
    expect(parseDashboardParams(new URLSearchParams(dashboardParamsToSearch(p)))).toEqual(p);
    expect(resolveRange(p, "UTC")).toEqual({ from: "2026-07-01", to: "2026-09-30" });
    const d = parseDashboardParams(new URLSearchParams("range=bogus&bu=nope&view=Bad!"));
    expect(d).toMatchObject({ view: null, preset: "last_30", businessUnitIds: [] });
    expect(dashboardParamsToSearch(d)).toBe("");
  });

  it("builds the tile API query", () => {
    expect(tileQuery({ from: "2026-09-01", to: "2026-09-30" }, ["a", "b"], true)).toBe(
      "from=2026-09-01&to=2026-09-30&business_unit_ids=a&business_unit_ids=b&refresh=true",
    );
  });
});

describe("tile links", () => {
  it("builds hrefs with repeated list params and a dashboard marker on report lists", () => {
    expect(tileHref({ path: "/demands", query: { status: ["open"], assignee: "me" } })).toBe("/demands?status=open&assignee=me");
    expect(tileHref({ path: "/reports/submissions", query: { db_sourced: "true", from: "2026-09-01" } })).toBe(
      "/reports/submissions?db_sourced=true&from=2026-09-01&src=dashboard",
    );
    expect(tileHref({ path: "/tasks", query: { view: "overdue", owner: "me" } })).toBe("/tasks?view=overdue&owner=me");
  });

  it("does not link to routes the app does not have", () => {
    expect(isKnownRoute("/applications/1")).toBe(false);
    expect(isKnownRoute("//evil.example")).toBe(false);
    expect(isKnownRoute("/demands/42")).toBe(true);
    const fallback = { path: "/reports/interviews", query: { mine: "true" } };
    expect(rowHref([{ path: "/applications/1", query: {} }], 0, fallback)).toBe("/reports/interviews?mine=true&src=dashboard");
    expect(rowHref(null, 0, null)).toBeNull();
  });

  it("narrows a series link to one bucket", () => {
    expect(bucketLink({ path: "/reports/offers", query: { from: "2026-09-01", to: "2026-09-30" } }, "2026-09-07", "2026-09-13").query).toEqual({
      from: "2026-09-07",
      to: "2026-09-13",
    });
  });
});

describe("chart theme", () => {
  it("maps series to Fluent tokens in a fixed order", () => {
    expect(SERIES_COLORS).toEqual([
      tokens.colorBrandBackground,
      tokens.colorPaletteMarigoldBorderActive,
      tokens.colorPaletteTealBorderActive,
      tokens.colorPaletteBerryBorderActive,
      tokens.colorPaletteLightGreenBorderActive,
    ]);
    expect(SERIES_COLORS.every((c) => c.startsWith("var(--"))).toBe(true);
    expect(seriesColor(0)).toBe(tokens.colorBrandBackground);
    expect(seriesColor(99)).toBe(tokens.colorPaletteLightGreenBorderActive);
    expect(seriesDash(0)).toBeUndefined();
    expect(seriesDash(1)).toBeTruthy();
  });

  it("styles axes, grid and tooltip from neutral tokens", () => {
    expect(AXIS_TICK).toEqual({ fill: tokens.colorNeutralForeground3, fontFamily: tokens.fontFamilyBase, fontSize: 12 });
    expect(GRID_COLOR).toBe(tokens.colorNeutralStroke2);
    expect(TOOLTIP_SURFACE).toMatchObject({ backgroundColor: tokens.colorNeutralBackground1, boxShadow: tokens.shadow8 });
  });
});

describe("tile view models", () => {
  it("detects sibling-count KPIs", () => {
    const tasks = {
      unit: null,
      rows: [
        { key: "due_today", label: "Due today", value: 3 },
        { key: "overdue", label: "Overdue", value: 2 },
      ],
      row_links: [
        { path: "/tasks", query: { view: "today" } },
        { path: "/tasks", query: { view: "overdue" } },
      ],
    };
    expect(kpiItems(tasks)?.map((k) => [k.label, k.value])).toEqual([
      ["Due today", 3],
      ["Overdue", 2],
    ]);
    expect(kpiItems({ ...tasks, unit: "%" })).toBeNull();
    expect(sampleNote({ key: "time_to_first_submission", n: 14 })).toBe("n = 14 demands");
  });

  it("drops table columns that are entirely null", () => {
    const cols = tableColumns("source_effectiveness", [{ source: "manual", applications: 4, submissions: 1, interviews: null, hires: 0, hire_rate: 0 }]);
    expect(cols.map((c) => c.key)).toEqual(["source", "applications", "submissions", "hires", "hire_rate"]);
    expect(tableColumns("unknown", [{ id: "x", name: "A", count: 2 }]).map((c) => c.key)).toEqual(["name", "count"]);
  });

  it("labels funnel bars with % of previous", () => {
    const bars = barData({
      kind: "funnel",
      rows: [
        { key: "applied", label: "Applied", value: 10, pct_of_previous: null },
        { key: "shortlisted", label: "Shortlisted", value: 4, pct_of_previous: 40 },
      ],
      row_links: [],
    });
    expect(bars.map(barLabel)).toEqual(["10", "4 (40%)"]);
  });

  it("merges series into zero-filled bucket rows", () => {
    const series = parseSeries({
      series: [
        { key: "submissions", label: "Submissions", points: [{ bucket: "2026-09-01", from: "2026-09-01", to: "2026-09-01", value: 2 }] },
        { key: "hires", label: "Hires", points: [{ bucket: "2026-09-01", from: "2026-09-01", to: "2026-09-01", value: 0 }] },
      ],
    });
    expect(seriesRows(series)).toEqual([{ bucket: "2026-09-01", from: "2026-09-01", to: "2026-09-01", submissions: 2, hires: 0 }]);
  });
});

describe("tile renderers", () => {
  const def: TileDefOut = { key: "open_demands", title: "Open demands", kind: "kpi", size: "s", description: "Demands currently Open.", available: true };

  it("renders a KPI as a large linked number with unit and sample size", () => {
    const html = render(
      createElement(KpiTile, {
        tile: {
          ...base,
          key: "time_to_first_submission",
          kind: "kpi",
          title: "Time to first submission",
          value: 26.5,
          unit: "hours",
          n: 14,
          link: { path: "/demands", query: { opened_from: "2026-09-01" } },
        },
      }),
    );
    expect(html).toContain("26.5");
    expect(html).toContain("hours");
    expect(html).toContain("n = 14 demands");
    expect(html).toContain('href="/demands?opened_from=2026-09-01"');
  });

  it("renders sibling KPIs with their own links", () => {
    const html = render(
      createElement(KpiTile, {
        tile: {
          ...base,
          key: "tasks_due",
          kind: "kpi",
          title: "Tasks",
          value: 3,
          rows: [
            { key: "due_today", label: "Due today", value: 3 },
            { key: "overdue", label: "Overdue", value: 2 },
          ],
          row_links: [
            { path: "/tasks", query: { view: "today" } },
            { path: "/tasks", query: { view: "overdue" } },
          ],
        },
      }),
    );
    expect(html).toContain("Overdue");
    expect(html).toContain('href="/tasks?view=overdue"');
  });

  it("renders a table with row links and SLA badges", () => {
    const html = render(
      createElement(TableTile, {
        tile: {
          ...base,
          key: "my_open_demands",
          kind: "table",
          title: "My open demands",
          rows: [{ id: "d1", req_id: "REQ-1", title: "Engineer", client: "Acme", sla_status: "at_risk", days_open: 4, pipeline_count: 7 }],
          row_links: [{ path: "/demands/d1", query: {} }],
        },
      }),
    );
    expect(html).toContain('href="/demands/d1"');
    expect(html).toContain("REQ-1");
    expect(html).toContain("At risk");
  });

  it("shows the timeout state and omits unavailable tiles", () => {
    const timeout = render(createElement(TileCard, { def, state: { status: "ok", tile: { ...base, key: "open_demands", kind: "kpi", title: "Open demands", status: "timeout" } } }));
    expect(timeout).toContain("Taking too long");
    const unavailable = { status: "ok", tile: { ...base, key: "open_demands", kind: "kpi", title: "Open demands", status: "unavailable" } } as const;
    expect(isTileVisible(def, unavailable)).toBe(false);
    expect(render(createElement(TileCard, { def, state: unavailable }))).not.toContain("Open demands");
    expect(isTileVisible({ available: false }, { status: "loading" })).toBe(false);
    expect(render(createElement(TileCard, { def, state: { status: "error" }, onRetry: () => undefined }))).toContain("Retry");
  });

  it("spans columns by size and collapses to one", () => {
    expect(tileSpan("l", 4)).toBe(3);
    expect(tileSpan("l", 2)).toBe(2);
    expect(tileSpan("m", 1)).toBe(1);
  });

  it("offers a table view of chart data", () => {
    const tile: TileOut = {
      ...base,
      key: "stage_conversion",
      kind: "funnel",
      title: "Stage conversion",
      rows: [
        { key: "applied", label: "Applied", value: 10, pct_of_previous: null },
        { key: "hired", label: "Hired", value: 2, pct_of_previous: 20 },
      ],
      row_links: [
        { path: "/reports/applications", query: { reached: "applied" } },
        { path: "/reports/applications", query: { reached: "hired" } },
      ],
    };
    const chart = render(createElement(ChartTile, { tile }));
    expect(chart).toContain("View as table");
    expect(chart).toContain('aria-pressed="false"');
    expect(chart).toMatch(/role="img" aria-label="Stage conversion: bar chart\. Applied 10, Hired 2 \(20%\)\."/);
    const table = render(createElement(ChartTile, { tile, initialView: "table" }));
    expect(table).toContain('aria-pressed="true"');
    expect(table).toContain('role="grid"');
    expect(table).toContain('href="/reports/applications?reached=hired&amp;src=dashboard"');
    expect(table).toContain("20%");
  });
});
