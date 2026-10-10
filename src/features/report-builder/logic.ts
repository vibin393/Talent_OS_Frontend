/**
 * Report builder logic (Epic 47) -- pure functions, unit-tested in `report-builder.test.ts`.
 *
 * The builder edits a `BuilderState` and serialises it to the foundation `Definition` + `VizSpec`. Values are
 * typed editors only: there is no expression / formula input anywhere (no free text reaches a query).
 */
import type {
  Agg,
  Bucket,
  Cadence,
  ColumnOut,
  Condition,
  Definition,
  FieldCatalog,
  FilterNode,
  GroupBy,
  Measure,
  Op,
  Row,
  RunResult,
  SortSpec,
  SourceCatalog,
  VizSpec,
  VizType,
} from "./types";

// ================================================================ builder state
export type BuilderMode = "rows" | "aggregate";
export type BuilderState = {
  source: string;
  mode: BuilderMode;
  fields: string[];
  filters: FilterNode | null;
  groupBy: GroupBy[];
  measures: Measure[];
  sort: SortSpec[];
  viz: VizSpec;
};

export const MAX_GROUP_BY = 3;
export const MAX_MEASURES = 10;
export const MAX_FIELDS = 50;
export const MAX_SORT = 3;

export function emptyState(source = ""): BuilderState {
  return { source, mode: "aggregate", fields: [], filters: null, groupBy: [], measures: [{ key: "count", agg: "count" }], sort: [], viz: { type: "table" } };
}

/** Keys a sort / viz may reference in the current mode. */
export function outputKeys(state: BuilderState): string[] {
  if (state.mode === "rows") return [...state.fields];
  const measures = state.measures.length ? state.measures.map((m) => m.key) : state.groupBy.length ? ["count"] : [];
  return [...state.groupBy.map((g) => g.field), ...measures];
}

function cleanFilters(node: FilterNode | null): FilterNode | null {
  if (!node) return null;
  if ("and" in node || "or" in node) {
    const kind = "and" in node ? "and" : "or";
    const children = ("and" in node ? node.and : node.or).map(cleanFilters).filter((c): c is FilterNode => c !== null);
    if (children.length === 0) return null;
    return kind === "and" ? { and: children } : { or: children };
  }
  return node.field ? node : null;
}

/** Serialise the builder to the foundation `Definition` (only registered keys, typed values). */
export function toDefinition(state: BuilderState): Definition {
  const def: Definition = { source: state.source };
  const filters = cleanFilters(state.filters);
  if (filters) def.filters = filters;
  if (state.mode === "rows") {
    def.fields = state.fields.slice(0, MAX_FIELDS);
  } else {
    def.group_by = state.groupBy.slice(0, MAX_GROUP_BY).map((g) => (g.bucket ? { field: g.field, bucket: g.bucket } : { field: g.field }));
    def.measures = state.measures.slice(0, MAX_MEASURES).map((m) => {
      const out: Measure = { key: m.key, agg: m.agg };
      if (m.field) out.field = m.field;
      if (m.of) out.of = m.of;
      return out;
    });
  }
  const keys = new Set(outputKeys(state));
  const sort = state.sort.filter((s) => keys.has(s.key)).slice(0, MAX_SORT);
  if (sort.length) def.sort = sort.map((s) => (s.desc ? { key: s.key, desc: true } : { key: s.key }));
  return def;
}

/** Rebuild the builder state from a saved definition (round trip of `toDefinition`). */
export function fromDefinition(def: Definition, viz: VizSpec): BuilderState {
  const aggregate = (def.group_by?.length ?? 0) > 0 || (def.measures?.length ?? 0) > 0;
  return {
    source: def.source,
    mode: aggregate ? "aggregate" : "rows",
    fields: [...(def.fields ?? [])],
    filters: def.filters ?? null,
    groupBy: (def.group_by ?? []).map((g) => ({ field: g.field, bucket: g.bucket ?? null })),
    measures: (def.measures ?? []).map((m) => ({ key: m.key, agg: m.agg, field: m.field ?? null, of: m.of ?? null })),
    sort: (def.sort ?? []).map((s) => ({ key: s.key, desc: !!s.desc })),
    viz: { ...viz },
  };
}

// ================================================================ catalogue helpers
export function fieldMap(source: SourceCatalog | undefined): Map<string, FieldCatalog> {
  return new Map((source?.fields ?? []).map((f) => [f.key, f]));
}

export type FieldTreeNode = { value: string; label: string; children: FieldCatalog[] };

/** Fields grouped by join (`""` = the source itself) for the field `Tree`. */
export function fieldTree(source: SourceCatalog | undefined): FieldTreeNode[] {
  const groups = new Map<string, FieldCatalog[]>();
  for (const f of source?.fields ?? []) {
    const key = f.join ?? "";
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)))
    .map(([join, fields]) => ({ value: join || "__root", label: join ? titleCase(join) : (source?.label ?? "Fields"), children: fields }));
}

export function titleCase(s: string): string {
  return s.replace(/[_.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Why a field cannot be used (permission tooltip), or null. */
export function unavailableReason(f: FieldCatalog, use: "display" | "filter" | "group" | "measure"): string | null {
  if (f.masked) return use === "display" ? null : "Requires Compensation access";
  if (use === "display" && !f.displayable) return "Can only be used in filters";
  if (use === "filter" && f.ops.length === 0) return "Display only";
  if (use === "group" && !f.groupable) return "Cannot be grouped";
  if (use === "measure" && f.aggs.length === 0) return "No aggregates";
  return null;
}

// ================================================================ filters (AND / OR tree)
export type Path = number[];

export const OP_LABELS: Record<Op, string> = {
  eq: "is",
  ne: "is not",
  in: "is any of",
  not_in: "is none of",
  lt: "less than",
  lte: "at most",
  gt: "greater than",
  gte: "at least",
  between: "between",
  contains: "contains",
  starts_with: "starts with",
  is_null: "is empty",
  within_days: "within the last (days)",
  skill_match: "has skill",
};

export type ValueEditor = "text" | "number" | "date" | "bool" | "enum" | "enum_multi" | "text_multi" | "range_number" | "range_date" | "days" | "none";

/** The typed editor of a condition value (never a free-form expression). */
export function valueEditor(f: FieldCatalog | undefined, op: Op): ValueEditor {
  if (!f) return "none";
  if (op === "is_null") return "bool";
  if (op === "within_days") return "days";
  const numeric = f.type === "int" || f.type === "decimal";
  const dated = f.type === "date" || f.type === "datetime";
  if (op === "between") return numeric ? "range_number" : dated ? "range_date" : "none";
  if (op === "in" || op === "not_in") return f.type === "enum" ? "enum_multi" : "text_multi";
  if (f.type === "bool") return "bool";
  if (f.type === "enum") return "enum";
  if (numeric) return "number";
  if (dated) return "date";
  return "text";
}

export function defaultValue(f: FieldCatalog | undefined, op: Op): unknown {
  switch (valueEditor(f, op)) {
    case "bool":
      return op === "is_null" ? true : true;
    case "enum":
      return f?.enum_values?.[0] ?? "";
    case "enum_multi":
    case "text_multi":
      return [];
    case "range_number":
      return [0, 0];
    case "range_date":
      return ["", ""];
    case "days":
      return 30;
    case "number":
      return 0;
    default:
      return "";
  }
}

export function newCondition(f: FieldCatalog): Condition {
  const op = (f.ops.includes("eq") ? "eq" : f.ops[0]) as Op;
  return { field: f.key, op, value: defaultValue(f, op) };
}

export function isGroup(node: FilterNode): node is { and: FilterNode[] } | { or: FilterNode[] } {
  return "and" in node || "or" in node;
}

export function groupKind(node: FilterNode): "and" | "or" | null {
  return "and" in node ? "and" : "or" in node ? "or" : null;
}

export function children(node: FilterNode): FilterNode[] {
  return "and" in node ? node.and : "or" in node ? node.or : [];
}

function withChildren(node: FilterNode, kids: FilterNode[]): FilterNode {
  return groupKind(node) === "or" ? { or: kids } : { and: kids };
}

/** The root is always a group in the editor. */
export function ensureRoot(node: FilterNode | null): FilterNode {
  if (!node) return { and: [] };
  return isGroup(node) ? node : { and: [node] };
}

export function nodeAt(root: FilterNode, path: Path): FilterNode {
  return path.reduce<FilterNode>((n, i) => children(n)[i], root);
}

function updateAt(root: FilterNode, path: Path, fn: (n: FilterNode) => FilterNode | null): FilterNode | null {
  if (path.length === 0) return fn(root);
  const [head, ...rest] = path;
  const kids = children(root);
  const next = updateAt(kids[head], rest, fn);
  const out = kids.flatMap((k, i) => (i === head ? (next ? [next] : []) : [k]));
  return withChildren(root, out);
}

export function addChild(root: FilterNode, path: Path, child: FilterNode): FilterNode {
  return updateAt(root, path, (n) => withChildren(n, [...children(n), child])) ?? root;
}

export function replaceAt(root: FilterNode, path: Path, node: FilterNode): FilterNode {
  return updateAt(root, path, () => node) ?? root;
}

export function removeAt(root: FilterNode, path: Path): FilterNode {
  if (path.length === 0) return { and: [] };
  return updateAt(root, path, () => null) ?? { and: [] };
}

export function toggleKind(root: FilterNode, path: Path): FilterNode {
  return updateAt(root, path, (n) => (groupKind(n) === "and" ? { or: children(n) } : { and: children(n) })) ?? root;
}

export function countConditions(node: FilterNode | null): number {
  if (!node) return 0;
  return isGroup(node) ? children(node).reduce((s, c) => s + countConditions(c), 0) : 1;
}

export function depth(node: FilterNode | null): number {
  if (!node || !isGroup(node)) return 0;
  return 1 + Math.max(0, ...children(node).map(depth));
}

// ================================================================ measures
export const AGG_LABELS: Record<Agg, string> = {
  count: "Count",
  count_distinct: "Count distinct",
  sum: "Sum",
  avg: "Average",
  min: "Minimum",
  max: "Maximum",
  ratio: "Ratio of two measures",
  pct_of_total: "Percent of total",
};

/** A unique measure key (`^[a-z][a-z0-9_]{0,39}$`) from the function and field. */
export function measureKey(agg: Agg, field: string | null | undefined, taken: readonly string[]): string {
  const base = `${agg}_${(field ?? "rows").replace(/[^a-z0-9]+/gi, "_")}`.toLowerCase().replace(/^[^a-z]+/, "m_").slice(0, 36);
  let key = base;
  for (let i = 2; taken.includes(key); i++) key = `${base}_${i}`.slice(0, 40);
  return key;
}

/** Functions available for a field (``count`` / ``pct_of_total`` also work on rows). */
export function aggsFor(f: FieldCatalog | undefined): Agg[] {
  if (!f) return ["count", "pct_of_total"];
  const out: Agg[] = [...f.aggs];
  if (f.aggs.includes("sum")) out.push("pct_of_total");
  return out;
}

/** Earlier measures a ratio at `index` may divide (the foundation needs `of` to name earlier keys). */
export function ratioCandidates(measures: readonly Measure[], index: number): string[] {
  return measures.slice(0, index).filter((m) => m.agg !== "ratio").map((m) => m.key);
}

export function configureRatio(measures: Measure[], index: number, numerator: string, denominator: string): Measure[] {
  const allowed = ratioCandidates(measures, index);
  if (!allowed.includes(numerator) || !allowed.includes(denominator)) return measures;
  return measures.map((m, i) => (i === index ? { key: m.key, agg: "ratio", of: [numerator, denominator], field: null } : m));
}

export function configurePctOfTotal(measures: Measure[], index: number, field: string | null): Measure[] {
  return measures.map((m, i) => (i === index ? { key: m.key, agg: "pct_of_total", field, of: null } : m));
}

/** Client-side check before preview: messages keyed by measure index. */
export function measureErrors(measures: readonly Measure[]): Record<number, string> {
  const errors: Record<number, string> = {};
  const seen = new Set<string>();
  measures.forEach((m, i) => {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(m.key)) errors[i] = "Use lower-case letters, digits and _";
    else if (seen.has(m.key)) errors[i] = "Duplicate name";
    else if (m.agg === "ratio" && (!m.of || !ratioCandidates(measures, i).includes(m.of[0]) || !ratioCandidates(measures, i).includes(m.of[1])))
      errors[i] = "Pick two earlier measures";
    else if (!["count", "pct_of_total", "ratio"].includes(m.agg) && !m.field) errors[i] = "Pick a field";
    seen.add(m.key);
  });
  return errors;
}

/** Removing a measure also removes ratios over it (as the viewer adaptation does server-side). */
export function removeMeasure(measures: readonly Measure[], key: string): Measure[] {
  const gone = new Set([key]);
  return measures.filter((m) => {
    if (gone.has(m.key)) return false;
    if (m.agg === "ratio" && m.of && (gone.has(m.of[0]) || gone.has(m.of[1]))) {
      gone.add(m.key);
      return false;
    }
    return true;
  });
}

// ================================================================ viz
export const VIZ_LABELS: Record<VizType, string> = { table: "Table", pivot: "Pivot", bar: "Bar", line: "Line", pie: "Pie", kpi: "KPI" };

/** Viz types the current shape supports. */
export function allowedViz(state: BuilderState): VizType[] {
  if (state.mode === "rows") return ["table"];
  const g = state.groupBy.length;
  if (g === 0) return ["kpi", "table"];
  const out: VizType[] = ["table", "bar", "line", "pie"];
  if (g >= 2) out.splice(1, 0, "pivot");
  return out;
}

/** Fill / repair the viz keys so they always name keys of the definition. */
export function normalizeViz(state: BuilderState): VizSpec {
  const allowed = allowedViz(state);
  const type = allowed.includes(state.viz.type) ? state.viz.type : allowed[0];
  if (type === "table") return { type };
  const groups = state.groupBy.map((g) => g.field);
  const measures = state.measures.length ? state.measures.map((m) => m.key) : ["count"];
  const pick = (v: string | null | undefined, from: string[], fallback: string | null) => (v && from.includes(v) ? v : fallback);
  const value = pick(state.viz.value, measures, measures[0] ?? null);
  if (type === "kpi") return { type, value };
  const x = pick(state.viz.x, groups, groups[0] ?? null);
  const series = type === "pie" ? null : pick(state.viz.series, groups.filter((g) => g !== x), type === "pivot" ? (groups.find((g) => g !== x) ?? null) : null);
  return { type, x, series, value };
}

// ================================================================ result formatting
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Bucket label: month buckets as "Apr 2026", FY buckets as "FY 26-27", quarters as "Q2 2026". */
export function bucketLabel(value: string | number | boolean | null, bucket: Bucket | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const s = String(value);
  if (bucket === "fy") return `FY ${s}`;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  const [, y, mo] = m;
  if (bucket === "month") return `${MONTHS[Number(mo) - 1]} ${y}`;
  if (bucket === "quarter") return `Q${Math.floor((Number(mo) - 1) / 3) + 1} ${y}`;
  return s.slice(0, 10);
}

/** Order of a month bucket inside its financial year (April = 0 ... March = 11). */
export function fyMonthIndex(value: string): number {
  const m = /^\d{4}-(\d{2})/.exec(value);
  return m ? (Number(m[1]) + 8) % 12 : 0;
}

export function formatCell(value: Row[string], column: Pick<ColumnOut, "type" | "masked">): string {
  if (column.masked) return "Hidden";
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (column.type === "decimal" || column.type === "int") {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : String(value);
  }
  if (column.type === "datetime") return String(value).replace("T", " ").slice(0, 16);
  return String(value);
}

/** The "Hidden: requires Compensation access" note for masked columns / removed measures. */
export function maskedNote(masked: readonly string[], fields: Map<string, FieldCatalog>): string | null {
  if (!masked.length) return null;
  const labels = masked.map((k) => fields.get(k)?.label ?? k);
  const identity = masked.some((k) => fields.get(k)?.pii_class === "identity");
  return `Hidden: requires ${identity ? "Compensation or Identity" : "Compensation"} access — ${labels.join(", ")}`;
}

export type ChartPoint = { x: string; [series: string]: string | number | null };

/** recharts rows: one point per `x` bucket, one numeric key per series value (or the measure). */
export function chartData(result: Pick<RunResult, "rows">, viz: VizSpec, bucket?: Bucket | null): { points: ChartPoint[]; series: string[] } {
  const xKey = viz.x ?? "";
  const valueKey = viz.value ?? "";
  const seriesKey = viz.series ?? null;
  const byX = new Map<string, ChartPoint>();
  const series = new Set<string>();
  for (const row of result.rows) {
    const x = bucketLabel(row[xKey] ?? null, bucket);
    const s = seriesKey ? String(row[seriesKey] ?? "—") : valueKey;
    series.add(s);
    const point = byX.get(x) ?? { x };
    const n = Number(row[valueKey]);
    point[s] = Number.isFinite(n) ? n : null;
    byX.set(x, point);
  }
  return { points: [...byX.values()], series: [...series] };
}

/** Pivot table cells: rows by `x`, columns by `series`. */
export function pivot(result: Pick<RunResult, "rows">, viz: VizSpec): { rows: string[]; cols: string[]; cell: (r: string, c: string) => string | number | null } {
  const xKey = viz.x ?? "";
  const sKey = viz.series ?? "";
  const vKey = viz.value ?? "";
  const cells = new Map<string, string | number | null>();
  const rows: string[] = [];
  const cols: string[] = [];
  for (const row of result.rows) {
    const r = String(row[xKey] ?? "—");
    const c = String(row[sKey] ?? "—");
    if (!rows.includes(r)) rows.push(r);
    if (!cols.includes(c)) cols.push(c);
    cells.set(`${r}\u0000${c}`, (row[vKey] as string | number | null) ?? null);
  }
  return { rows, cols, cell: (r, c) => cells.get(`${r}\u0000${c}`) ?? null };
}

// ================================================================ schedules
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function zoneParts(at: Date, timeZone: string): { y: number; m: number; d: number; hh: number; mm: number; dow: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  return { y: Number(get("year")), m: Number(get("month")), d: Number(get("day")), hh: Number(get("hour")), mm: Number(get("minute")), dow };
}

/** UTC instant of a wall-clock time in `timeZone` (two-pass offset correction, DST-safe). */
export function zonedToUtc(y: number, m: number, d: number, hh: number, mm: number, timeZone: string): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let ts = guess;
  for (let i = 0; i < 2; i++) {
    const p = zoneParts(new Date(ts), timeZone);
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
    ts = guess - (asUtc - ts);
  }
  return new Date(ts);
}

/** The next `n` run times of a schedule after `from` (same rules as the server's `next_occurrence`). */
export function nextRuns(
  s: { cadence: Cadence; weekday?: number | null; month_day?: number | null; local_time: string; timezone: string },
  from: Date,
  n = 3,
): Date[] {
  const [hh, mm] = s.local_time.split(":").map(Number);
  const start = zoneParts(from, s.timezone);
  const out: Date[] = [];
  for (let i = 0; i < 400 && out.length < n; i++) {
    const day = new Date(Date.UTC(start.y, start.m - 1, start.d + i));
    const y = day.getUTCFullYear();
    const m = day.getUTCMonth() + 1;
    const d = day.getUTCDate();
    const dow = (day.getUTCDay() + 6) % 7; // Monday = 0
    if (s.cadence === "weekly" && dow !== s.weekday) continue;
    if (s.cadence === "monthly") {
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      if (d !== (s.month_day === -1 ? last : s.month_day)) continue;
    }
    const at = zonedToUtc(y, m, d, hh, mm, s.timezone);
    if (at.getTime() > from.getTime()) out.push(at);
  }
  return out;
}

export function scheduleSummary(s: { cadence: Cadence; weekday?: number | null; month_day?: number | null; local_time: string; timezone: string }): string {
  const time = s.local_time.slice(0, 5);
  if (s.cadence === "daily") return `Daily at ${time} (${s.timezone})`;
  if (s.cadence === "weekly") return `Every ${WEEKDAYS[s.weekday ?? 0]} at ${time} (${s.timezone})`;
  return `Monthly on the ${s.month_day === -1 ? "last day" : `${s.month_day}`} at ${time} (${s.timezone})`;
}

export function limitMessage(result: Pick<RunResult, "limit_hit" | "truncated" | "row_limit" | "total">): { intent: "warning" | "info"; text: string } | null {
  if (result.limit_hit) return { intent: "warning", text: result.limit_hit.message };
  if (result.truncated) return { intent: "info", text: `Showing the first ${result.row_limit.toLocaleString("en-IN")} of ${(result.total ?? 0).toLocaleString("en-IN")} rows. Export for the full result.` };
  return null;
}
