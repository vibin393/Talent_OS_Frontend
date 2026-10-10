import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPORTS_NAV_GROUP } from "@/components/app-shell/nav-items";
import {
  addChild,
  allowedViz,
  bucketLabel,
  chartData,
  configurePctOfTotal,
  configureRatio,
  countConditions,
  emptyState,
  ensureRoot,
  fieldMap,
  fromDefinition,
  fyMonthIndex,
  limitMessage,
  maskedNote,
  measureErrors,
  measureKey,
  nextRuns,
  normalizeViz,
  pivot,
  ratioCandidates,
  removeAt,
  removeMeasure,
  toDefinition,
  toggleKind,
  valueEditor,
  zonedToUtc,
  type BuilderState,
} from "./logic";
import type { Definition, FieldCatalog, Measure, SourceCatalog } from "./types";

function field(key: string, over: Partial<FieldCatalog> = {}): FieldCatalog {
  return {
    key,
    label: key,
    type: "string",
    pii_class: "none",
    ops: ["eq", "in"],
    aggs: [],
    groupable: true,
    date_buckets: false,
    enum_values: null,
    join: null,
    displayable: true,
    masked: false,
    ...over,
  };
}

const EXAMPLE: Definition = {
  source: "placements.placement",
  filters: { and: [{ field: "status", op: "in", value: ["active"] }, { or: [{ field: "planned_start_date", op: "within_days", value: 365 }] }] },
  group_by: [{ field: "client.name" }, { field: "planned_start_date", bucket: "month" }],
  measures: [
    { key: "placements", agg: "count" },
    { key: "bill", agg: "sum", field: "bill_rate" },
    { key: "pay", agg: "sum", field: "pay_rate" },
    { key: "bill_pay", agg: "ratio", of: ["bill", "pay"] },
    { key: "share", agg: "pct_of_total", field: "bill_rate" },
  ],
  sort: [{ key: "bill", desc: true }],
};

describe("definition serialisation", () => {
  it("round-trips a saved definition through the builder state", () => {
    const viz = { type: "bar" as const, x: "planned_start_date", series: "client.name", value: "bill" };
    const state = fromDefinition(EXAMPLE, viz);
    expect(state.mode).toBe("aggregate");
    expect(toDefinition(state)).toEqual(EXAMPLE);
    expect(normalizeViz(state)).toEqual(viz);
  });

  it("serialises row mode without group-by / measures and drops stale sort keys", () => {
    const state: BuilderState = { ...emptyState("placements.placement"), mode: "rows", fields: ["human_id", "bill_rate"], measures: [], sort: [{ key: "gone" }, { key: "human_id", desc: true }] };
    expect(toDefinition(state)).toEqual({ source: "placements.placement", fields: ["human_id", "bill_rate"], sort: [{ key: "human_id", desc: true }] });
  });

  it("drops empty filter groups", () => {
    const state: BuilderState = { ...emptyState("x.y"), filters: { and: [{ or: [] }] } };
    expect(toDefinition(state).filters).toBeUndefined();
  });
});

describe("filter tree", () => {
  it("adds, toggles and removes nested conditions", () => {
    let root = ensureRoot(null);
    root = addChild(root, [], { field: "status", op: "eq", value: "active" });
    root = addChild(root, [], { or: [] });
    root = addChild(root, [1], { field: "client.name", op: "eq", value: "Acme" });
    expect(countConditions(root)).toBe(2);
    root = toggleKind(root, [1]);
    expect(root).toEqual({ and: [{ field: "status", op: "eq", value: "active" }, { and: [{ field: "client.name", op: "eq", value: "Acme" }] }] });
    root = removeAt(root, [1, 0]);
    expect(countConditions(root)).toBe(1);
  });

  it("chooses typed value editors (never a free-text expression)", () => {
    expect(valueEditor(field("n", { type: "decimal" }), "between")).toBe("range_number");
    expect(valueEditor(field("d", { type: "date" }), "within_days")).toBe("days");
    expect(valueEditor(field("s", { type: "enum", enum_values: ["a"] }), "in")).toBe("enum_multi");
    expect(valueEditor(field("b", { type: "bool" }), "eq")).toBe("bool");
  });
});

describe("measures: ratio and percent of total", () => {
  const measures: Measure[] = [
    { key: "bill", agg: "sum", field: "bill_rate" },
    { key: "pay", agg: "sum", field: "pay_rate" },
    { key: "r", agg: "count" },
  ];

  it("a ratio may only divide earlier measures", () => {
    expect(ratioCandidates(measures, 2)).toEqual(["bill", "pay"]);
    const configured = configureRatio(measures, 2, "bill", "pay");
    expect(configured[2]).toEqual({ key: "r", agg: "ratio", of: ["bill", "pay"], field: null });
    expect(configureRatio(measures, 0, "bill", "pay")).toBe(measures); // nothing earlier than the first
    expect(measureErrors(configured)).toEqual({});
    expect(measureErrors([{ key: "r", agg: "ratio", of: ["bill", "pay"] }])).toEqual({ 0: "Pick two earlier measures" });
  });

  it("percent of total picks one field (or rows)", () => {
    const configured = configurePctOfTotal(measures, 2, "bill_rate");
    expect(configured[2]).toEqual({ key: "r", agg: "pct_of_total", field: "bill_rate", of: null });
    expect(measureErrors(configurePctOfTotal(measures, 2, null))).toEqual({});
  });

  it("removing a measure removes the ratios over it", () => {
    const withRatio = configureRatio(measures, 2, "bill", "pay");
    expect(removeMeasure(withRatio, "pay").map((m) => m.key)).toEqual(["bill"]);
  });

  it("builds unique, valid measure keys", () => {
    expect(measureKey("sum", "bill_rate", [])).toBe("sum_bill_rate");
    expect(measureKey("sum", "bill_rate", ["sum_bill_rate"])).toBe("sum_bill_rate_2");
    expect(measureKey("count", null, [])).toBe("count_rows");
  });
});

describe("viz", () => {
  it("offers charts only with group-bys and a pivot with two", () => {
    const base = fromDefinition(EXAMPLE, { type: "table" });
    expect(allowedViz(base)).toEqual(["table", "pivot", "bar", "line", "pie"]);
    expect(allowedViz({ ...base, groupBy: [] })).toEqual(["kpi", "table"]);
    expect(allowedViz({ ...base, mode: "rows" })).toEqual(["table"]);
    expect(normalizeViz({ ...base, viz: { type: "kpi" } }).type).toBe("table");
  });

  it("pivots rows and builds chart series", () => {
    const rows = [
      { "client.name": "Acme", planned_start_date: "2026-04-01", bill: "200" },
      { "client.name": "Globex", planned_start_date: "2026-04-01", bill: "300" },
      { "client.name": "Acme", planned_start_date: "2026-05-01", bill: "50" },
    ];
    const viz = { type: "bar" as const, x: "planned_start_date", series: "client.name", value: "bill" };
    const { points, series } = chartData({ rows }, viz, "month");
    expect(series).toEqual(["Acme", "Globex"]);
    expect(points).toEqual([{ x: "Apr 2026", Acme: 200, Globex: 300 }, { x: "May 2026", Acme: 50 }]);
    const p = pivot({ rows }, viz);
    expect(p.rows).toEqual(["2026-04-01", "2026-05-01"]);
    expect(p.cell("2026-05-01", "Globex")).toBeNull();
  });

  it("labels FY buckets and orders months in FY order", () => {
    expect(bucketLabel("26-27", "fy")).toBe("FY 26-27");
    expect(bucketLabel("2026-07-01", "quarter")).toBe("Q3 2026");
    expect(fyMonthIndex("2026-04-01")).toBe(0);
    expect(fyMonthIndex("2027-03-01")).toBe(11);
  });
});

describe("masked-field note and limits", () => {
  const source: SourceCatalog = { key: "p", label: "P", fields: [field("bill_rate", { label: "Bill rate", pii_class: "compensation", masked: true })] };

  it("explains hidden columns and removed measures", () => {
    expect(maskedNote(["bill_rate", "bill"], fieldMap(source))).toBe("Hidden: requires Compensation access — Bill rate, bill");
    expect(maskedNote([], fieldMap(source))).toBeNull();
  });

  it("warns when a limit stopped the run", () => {
    expect(limitMessage({ limit_hit: { kind: "row_cap", message: "Stopped at 100,000 rows" }, truncated: true, row_limit: 500, total: 1 })).toEqual({ intent: "warning", text: "Stopped at 100,000 rows" });
    expect(limitMessage({ limit_hit: null, truncated: true, row_limit: 500, total: 1200 })?.intent).toBe("info");
    expect(limitMessage({ limit_hit: null, truncated: false, row_limit: 500, total: 3 })).toBeNull();
  });
});

describe("schedule next-run preview", () => {
  const from = new Date("2026-10-06T10:00:00Z"); // Tuesday 15:30 IST

  it("matches the server's rules in the schedule's time zone", () => {
    const weekly = nextRuns({ cadence: "weekly", weekday: 0, local_time: "09:00:00", timezone: "Asia/Kolkata" }, from, 2);
    expect(weekly.map((d) => d.toISOString())).toEqual(["2026-10-12T03:30:00.000Z", "2026-10-19T03:30:00.000Z"]);
    const daily = nextRuns({ cadence: "daily", local_time: "16:00:00", timezone: "Asia/Kolkata" }, from, 1);
    expect(daily[0].toISOString()).toBe("2026-10-06T10:30:00.000Z");
    const lastDay = nextRuns({ cadence: "monthly", month_day: -1, local_time: "08:00:00", timezone: "Asia/Kolkata" }, from, 2);
    expect(lastDay.map((d) => d.toISOString())).toEqual(["2026-10-31T02:30:00.000Z", "2026-11-30T02:30:00.000Z"]);
  });

  it("handles DST zones", () => {
    expect(zonedToUtc(2026, 10, 6, 9, 0, "America/New_York").toISOString()).toBe("2026-10-06T13:00:00.000Z");
    expect(zonedToUtc(2026, 12, 1, 9, 0, "America/New_York").toISOString()).toBe("2026-12-01T14:00:00.000Z");
  });
});

describe("no expression input", () => {
  it("the builder has no free-text expression / formula / SQL input", () => {
    const dir = join(__dirname);
    const sources = readdirSync(dir).filter((f) => f.endsWith(".tsx"));
    expect(sources).toContain("filter-tree.tsx");
    for (const name of sources) {
      // Code only: comments may explain that there is no expression input.
      const text = readFileSync(join(dir, name), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(text, name).not.toMatch(/expression|formula|\bsql\b/i);
      expect(text, name).not.toMatch(/<Textarea/);
    }
  });

  it("is reachable from the Reports nav group", () => {
    expect(REPORTS_NAV_GROUP.items.some((i) => i.href === "/reports/custom")).toBe(true);
  });
});
