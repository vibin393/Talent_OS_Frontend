/**
 * Pure logic of the segment builder (Epic 38): the editable AND/OR tree and its JSON definition, the
 * operators offered per field type, the value editor kind and value coercion. No React here.
 */
import type {
  ConditionNode,
  Definition,
  FieldType,
  FilterNode,
  Operator,
  SemanticField,
  SemanticSource,
  SkillMatchValue,
  SourceKey,
} from "./types";

export const MAX_DEPTH = 5;
export const MAX_CONDITIONS = 50;
export const PREVIEW_DEBOUNCE_MS = 600;

export const SOURCE_LABELS: Record<SourceKey, string> = {
  "candidates.candidate": "Candidates",
  "placements.worker": "Workers",
};

// ---------------------------------------------------------------------------------------------------
// Builder tree
// ---------------------------------------------------------------------------------------------------

export type Combinator = "and" | "or";
export type BuilderCondition = { kind: "condition"; id: string; field: string; op: string; value: unknown };
export type BuilderGroup = { kind: "group"; id: string; combinator: Combinator; children: BuilderNode[] };
export type BuilderNode = BuilderCondition | BuilderGroup;

let seq = 0;
export function newNodeId(): string {
  seq += 1;
  return `n${seq}`;
}

export function emptyCondition(): BuilderCondition {
  return { kind: "condition", id: newNodeId(), field: "", op: "", value: null };
}

export function emptyGroup(combinator: Combinator = "and", withCondition = true): BuilderGroup {
  return { kind: "group", id: newNodeId(), combinator, children: withCondition ? [emptyCondition()] : [] };
}

function isAnd(n: FilterNode): n is { and: FilterNode[] } {
  return typeof n === "object" && n !== null && Array.isArray((n as { and?: unknown }).and);
}
function isOr(n: FilterNode): n is { or: FilterNode[] } {
  return typeof n === "object" && n !== null && Array.isArray((n as { or?: unknown }).or);
}

function nodeToTree(n: FilterNode): BuilderNode {
  if (isAnd(n)) return { kind: "group", id: newNodeId(), combinator: "and", children: n.and.map(nodeToTree) };
  if (isOr(n)) return { kind: "group", id: newNodeId(), combinator: "or", children: n.or.map(nodeToTree) };
  const c = n as ConditionNode;
  return { kind: "condition", id: newNodeId(), field: c.field ?? "", op: c.op ?? "", value: c.value ?? null };
}

/** Definition JSON -> builder tree. The root is always a group; a bare leaf becomes `and[leaf]`. */
export function definitionToTree(defn: Definition | null | undefined): BuilderGroup {
  const f = defn?.filters;
  if (!f) return emptyGroup("and");
  const node = nodeToTree(f);
  return node.kind === "group" ? node : { kind: "group", id: newNodeId(), combinator: "and", children: [node] };
}

/** True when the value is complete enough to send for `op`. */
export function isValueComplete(op: string, value: unknown): boolean {
  switch (op) {
    case "in":
    case "not_in":
      return Array.isArray(value) && value.length > 0;
    case "between":
      return Array.isArray(value) && value.length === 2 && value.every((v) => v !== null && v !== "" && v !== undefined);
    case "is_null":
      return typeof value === "boolean";
    case "within_days": {
      const days = typeof value === "number" ? value : (value as { days?: unknown } | null)?.days;
      return typeof days === "number" && Number.isInteger(days) && days >= 0;
    }
    case "skill_match":
      return !!(value as SkillMatchValue | null)?.ref?.id;
    default:
      return value !== null && value !== undefined && value !== "" && !(typeof value === "number" && Number.isNaN(value));
  }
}

function stripSkillLabel(op: string, value: unknown): unknown {
  if (op !== "skill_match" || !value || typeof value !== "object") return value;
  const { ref, min_proficiency, expand } = value as SkillMatchValue;
  return { ref, min_proficiency: min_proficiency ?? null, expand: !!expand };
}

function treeToNode(n: BuilderNode, dropIncomplete: boolean): FilterNode | null {
  if (n.kind === "condition") {
    if (!n.field || !n.op) return null;
    if (dropIncomplete && !isValueComplete(n.op, n.value)) return null;
    return { field: n.field, op: n.op, value: stripSkillLabel(n.op, n.value) };
  }
  const children = n.children.map((c) => treeToNode(c, dropIncomplete)).filter((c): c is FilterNode => c !== null);
  if (children.length === 0) return null;
  return n.combinator === "and" ? { and: children } : { or: children };
}

/**
 * Builder tree -> definition JSON. Rows without a field or operator, and empty groups, are dropped;
 * with `dropIncomplete` (live preview) rows whose value is still incomplete are dropped too.
 */
export function treeToDefinition(root: BuilderGroup, { dropIncomplete = false } = {}): Definition {
  return { filters: treeToNode(root, dropIncomplete) };
}

/** Group nesting depth (a root group counts as 1, a bare leaf as 0) and number of conditions. */
export function definitionStats(defn: Definition | null | undefined): { depth: number; conditions: number } {
  const walk = (n: FilterNode): { depth: number; conditions: number } => {
    const kids = isAnd(n) ? n.and : isOr(n) ? n.or : null;
    if (!kids) return { depth: 0, conditions: 1 };
    const stats = kids.map(walk);
    return {
      depth: 1 + Math.max(0, ...stats.map((s) => s.depth)),
      conditions: stats.reduce((sum, s) => sum + s.conditions, 0),
    };
  };
  return defn?.filters ? walk(defn.filters) : { depth: 0, conditions: 0 };
}

export function countConditions(n: BuilderNode): number {
  return n.kind === "condition" ? 1 : n.children.reduce((s, c) => s + countConditions(c), 0);
}

/** Replace the node with `id` (deep). `fn` returning null removes it. */
export function updateNode(root: BuilderGroup, id: string, fn: (n: BuilderNode) => BuilderNode | null): BuilderGroup {
  const visit = (n: BuilderNode): BuilderNode | null => {
    if (n.id === id) return fn(n);
    if (n.kind === "condition") return n;
    const children = n.children.map(visit).filter((c): c is BuilderNode => c !== null);
    return { ...n, children };
  };
  if (root.id === id) {
    const next = fn(root);
    return next && next.kind === "group" ? next : emptyGroup("and", false);
  }
  return visit(root) as BuilderGroup;
}

/** Node id at a 422 `details.path` such as `$.filters.and[1].or[0].value` (indices walk the tree). */
export function nodeIdAtPath(root: BuilderGroup, path: string | null | undefined): string | null {
  if (!path) return null;
  const idx = [...path.matchAll(/(?:\[|\.)(\d+)\]?/g)].map((m) => Number(m[1]));
  let node: BuilderNode = root;
  for (const i of idx) {
    if (node.kind !== "group" || !node.children[i]) break;
    node = node.children[i];
  }
  return node.id;
}

// ---------------------------------------------------------------------------------------------------
// Catalogue helpers
// ---------------------------------------------------------------------------------------------------

/** Fields offered in the builder: display-only fields (no operators) are excluded. */
export function filterableFields(source: SemanticSource | null | undefined): SemanticField[] {
  return (source?.fields ?? []).filter((f) => Array.isArray(f.ops) && f.ops.length > 0);
}

function humanize(key: string): string {
  const s = key.replace(/[._]+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : key;
}

/** Fields grouped by entity: the base entity first, then one group per join. */
export function groupFields(source: SemanticSource | null | undefined): { key: string; label: string; fields: SemanticField[] }[] {
  const groups = new Map<string, { key: string; label: string; fields: SemanticField[] }>();
  const base = source?.label ?? "Fields";
  for (const f of filterableFields(source)) {
    const key = f.join ?? "";
    if (!groups.has(key)) groups.set(key, { key, label: key ? humanize(key) : base, fields: [] });
    groups.get(key)!.fields.push(f);
  }
  return [...groups.values()].sort((a, b) => (a.key === "" ? -1 : b.key === "" ? 1 : a.label.localeCompare(b.label)));
}

/** Field keys a definition uses that the catalogue does not offer (removed, or forbidden to this user). */
export function unavailableFields(defn: Definition | null | undefined, source: SemanticSource | null | undefined): string[] {
  const offered = new Set(filterableFields(source).map((f) => f.key));
  const out = new Set<string>();
  const walk = (n: FilterNode) => {
    if (isAnd(n)) n.and.forEach(walk);
    else if (isOr(n)) n.or.forEach(walk);
    else if ((n as ConditionNode).field && !offered.has((n as ConditionNode).field)) out.add((n as ConditionNode).field);
  };
  if (defn?.filters) walk(defn.filters);
  return [...out];
}

// ---------------------------------------------------------------------------------------------------
// Operators
// ---------------------------------------------------------------------------------------------------

/** Operators that make sense for each field type (the catalogue's `ops` are intersected with these). */
export const OPS_BY_TYPE: Record<FieldType, readonly Operator[]> = {
  string: ["eq", "ne", "in", "not_in", "contains", "starts_with", "is_null"],
  uuid: ["eq", "ne", "in", "not_in", "is_null"],
  int: ["eq", "ne", "lt", "lte", "gt", "gte", "between", "in", "not_in", "is_null"],
  decimal: ["eq", "ne", "lt", "lte", "gt", "gte", "between", "is_null"],
  bool: ["eq", "ne", "is_null"],
  date: ["eq", "ne", "lt", "lte", "gt", "gte", "between", "within_days", "is_null"],
  datetime: ["lt", "lte", "gt", "gte", "between", "within_days", "is_null"],
  enum: ["eq", "ne", "in", "not_in", "is_null"],
  string_array: ["contains", "in", "not_in", "is_null"],
  skill: ["skill_match"],
};

const DATE_TYPES: readonly FieldType[] = ["date", "datetime"];

/** The operators offered for `field`: its catalogue `ops`, in catalogue order, valid for its type. */
export function operatorsForField(field: SemanticField | null | undefined): Operator[] {
  if (!field) return [];
  const allowed = OPS_BY_TYPE[field.type] ?? [];
  return field.ops.filter((op): op is Operator => (allowed as readonly string[]).includes(op));
}

export function operatorLabel(op: string, type?: FieldType): string {
  const date = type ? DATE_TYPES.includes(type) : false;
  switch (op) {
    case "eq":
      return "is";
    case "ne":
      return "is not";
    case "in":
      return type === "string_array" ? "has any of" : "is any of";
    case "not_in":
      return type === "string_array" ? "has none of" : "is none of";
    case "lt":
      return date ? "is before" : "is less than";
    case "lte":
      return date ? "is on or before" : "is at most";
    case "gt":
      return date ? "is after" : "is greater than";
    case "gte":
      return date ? "is on or after" : "is at least";
    case "between":
      return "is between";
    case "contains":
      return type === "string_array" ? "includes" : "contains";
    case "starts_with":
      return "starts with";
    case "is_null":
      return "is empty / not empty";
    case "within_days":
      return "is within";
    case "skill_match":
      return "has skill";
    default:
      return op;
  }
}

// ---------------------------------------------------------------------------------------------------
// Value editors
// ---------------------------------------------------------------------------------------------------

export type ValueKind =
  | "text"
  | "number"
  | "date"
  | "bool"
  | "enum"
  | "enum_multi"
  | "text_multi"
  | "number_multi"
  | "number_range"
  | "date_range"
  | "is_null"
  | "within_days"
  | "skill";

const isNumeric = (t: FieldType) => t === "int" || t === "decimal";

/** Which value editor a (field, operator) pair needs. */
export function valueKind(field: SemanticField, op: string): ValueKind {
  const t = field.type;
  if (op === "is_null") return "is_null";
  if (op === "within_days") return "within_days";
  if (op === "skill_match" || t === "skill") return "skill";
  if (op === "in" || op === "not_in") {
    if (t === "enum" || (field.enum_values && field.enum_values.length > 0)) return "enum_multi";
    return isNumeric(t) ? "number_multi" : "text_multi";
  }
  if (op === "between") return DATE_TYPES.includes(t) ? "date_range" : "number_range";
  if (t === "bool") return "bool";
  if (t === "enum") return "enum";
  if (isNumeric(t)) return "number";
  if (DATE_TYPES.includes(t)) return "date";
  return "text";
}

/** The initial value of a row after its field or operator changes. */
export function defaultValue(field: SemanticField, op: string): unknown {
  switch (valueKind(field, op)) {
    case "bool":
      return true;
    case "is_null":
      return true;
    case "enum_multi":
    case "text_multi":
    case "number_multi":
      return [];
    case "number_range":
    case "date_range":
      return [null, null];
    case "within_days":
      return { days: 30, direction: field.type === "date" ? "future" : "past" };
    case "skill":
      return { ref: null, min_proficiency: null, expand: true };
    default:
      return null;
  }
}

/** Raw input text -> typed value for a scalar editor (`null` when empty or invalid). */
export function coerceScalar(kind: ValueKind, raw: string, type?: FieldType): unknown {
  const s = raw.trim();
  if (!s) return null;
  if (kind === "number" || kind === "number_range" || kind === "number_multi") {
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return type === "int" ? Math.trunc(n) : n;
  }
  if (kind === "date" || kind === "date_range") return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  return s;
}

/** "a, b ,, c" -> typed list for `in` / `not_in` (trimmed, de-duplicated, invalid numbers dropped). */
export function coerceList(kind: ValueKind, raw: string, type?: FieldType): (string | number)[] {
  const out: (string | number)[] = [];
  for (const part of raw.split(",")) {
    const v = coerceScalar(kind === "number_multi" ? "number" : "text", part, type);
    if (v !== null && !out.includes(v as string | number)) out.push(v as string | number);
  }
  return out;
}

/** Days and direction of a `within_days` value (`int` means past). */
export function withinDaysParts(value: unknown): { days: number | null; direction: "past" | "future" } {
  if (typeof value === "number") return { days: value, direction: "past" };
  const v = value as { days?: unknown; direction?: unknown } | null;
  return {
    days: typeof v?.days === "number" ? v.days : null,
    direction: v?.direction === "future" ? "future" : "past",
  };
}

/** One-line summary of a condition, for reasons and tooltips. */
export function describeCondition(c: ConditionNode, field?: SemanticField | null): string {
  const label = field?.label ?? c.field;
  const op = operatorLabel(c.op, field?.type);
  const v = c.value;
  if (c.op === "is_null") return `${label} ${v ? "is empty" : "is not empty"}`;
  if (c.op === "within_days") {
    const { days, direction } = withinDaysParts(v);
    return `${label} ${direction === "future" ? "in the next" : "in the last"} ${days ?? "?"} days`;
  }
  if (c.op === "skill_match") {
    const s = v as SkillMatchValue | null;
    const parts = [s?.label ?? "skill"];
    if (s?.min_proficiency) parts.push(`≥ ${s.min_proficiency}`);
    if (s?.expand) parts.push("+ related");
    return `${label}: ${parts.join(" ")}`;
  }
  if (Array.isArray(v)) return `${label} ${op} ${c.op === "between" ? v.join(" and ") : v.join(", ")}`;
  return `${label} ${op} ${v === null || v === undefined ? "…" : String(v)}`;
}
