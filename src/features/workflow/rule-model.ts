/**
 * Pure model for the workflow rule builder: the editable draft (When / If / Then), its mapping to and from
 * the API JSON, value-editor choice per field type, `move_stage` target filtering and 422 path mapping.
 */
import type { PipelineStageOut, WorkflowFieldOut, WorkflowRuleOut } from "@/lib/api/types";

export type Match = "all" | "any";
export type ClauseDraft = { id: string; kind: "clause"; field: string; op: string; value: unknown };
export type GroupDraft = { id: string; kind: "group"; match: Match; clauses: ClauseDraft[] };
export type ConditionItem = ClauseDraft | GroupDraft;
export type ConditionsDraft = { match: Match; items: ConditionItem[] };
export type ActionDraft = { id: string; type: string; params: Record<string, unknown> };
export type RuleDraft = {
  name: string;
  description: string;
  trigger: string;
  conditions: ConditionsDraft;
  actions: ActionDraft[];
};

let seq = 0;
export function newId(prefix = "r"): string {
  seq += 1;
  return `${prefix}${seq}`;
}

export function newClause(field = "", op = "eq"): ClauseDraft {
  return { id: newId("c"), kind: "clause", field, op, value: null };
}

export function newGroup(match: Match = "any"): GroupDraft {
  return { id: newId("g"), kind: "group", match, clauses: [newClause()] };
}

export function emptyRule(trigger = ""): RuleDraft {
  return { name: "", description: "", trigger, conditions: { match: "all", items: [] }, actions: [] };
}

// ---------------------------------------------------------------- JSON <-> draft
type Json = Record<string, unknown>;

function isRecord(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function clauseFrom(node: Json): ClauseDraft | null {
  if (typeof node.field !== "string" || typeof node.op !== "string") return null;
  return { id: newId("c"), kind: "clause", field: node.field, op: node.op, value: node.value ?? null };
}

function matchOf(node: Json): Match | null {
  const keys = Object.keys(node);
  if (keys.length !== 1) return null;
  if (keys[0] === "all" && Array.isArray(node.all)) return "all";
  if (keys[0] === "any" && Array.isArray(node.any)) return "any";
  return null;
}

/**
 * Stored conditions -> draft. The builder edits "all / any" of clauses with one nested group level;
 * anything else (`not`, deeper nesting) is reported as `unsupported` and dropped from the draft.
 */
export function parseConditions(cond: unknown): { draft: ConditionsDraft; unsupported: boolean } {
  const draft: ConditionsDraft = { match: "all", items: [] };
  if (!isRecord(cond) || Object.keys(cond).length === 0) return { draft, unsupported: false };
  let unsupported = false;
  const top = matchOf(cond);
  const nodes: unknown[] = top ? (cond[top] as unknown[]) : [cond];
  if (top) draft.match = top;
  for (const node of nodes) {
    if (!isRecord(node)) {
      unsupported = true;
      continue;
    }
    const clause = clauseFrom(node);
    if (clause) {
      draft.items.push(clause);
      continue;
    }
    const m = matchOf(node);
    if (!m) {
      unsupported = true;
      continue;
    }
    const clauses: ClauseDraft[] = [];
    for (const inner of node[m] as unknown[]) {
      const c = isRecord(inner) ? clauseFrom(inner) : null;
      if (c) clauses.push(c);
      else unsupported = true;
    }
    if (clauses.length > 0) draft.items.push({ id: newId("g"), kind: "group", match: m, clauses });
  }
  return { draft, unsupported };
}

export const EMPTY_OPS = new Set(["is_empty", "is_not_empty"]);

function clauseJson(c: ClauseDraft): Json {
  return EMPTY_OPS.has(c.op) ? { field: c.field, op: c.op } : { field: c.field, op: c.op, value: c.value };
}

/** Draft -> API JSON. No clauses means "always" (`{}`). */
export function buildConditions(d: ConditionsDraft): Json {
  const nodes: Json[] = [];
  for (const item of d.items) {
    if (item.kind === "clause") nodes.push(clauseJson(item));
    else if (item.clauses.length > 0) nodes.push({ [item.match]: item.clauses.map(clauseJson) });
  }
  return nodes.length === 0 ? {} : { [d.match]: nodes };
}

export function ruleDraftFrom(rule: WorkflowRuleOut): { draft: RuleDraft; unsupported: boolean } {
  const { draft, unsupported } = parseConditions(rule.conditions);
  return {
    unsupported,
    draft: {
      name: rule.name,
      description: rule.description ?? "",
      trigger: rule.trigger,
      conditions: draft,
      actions: rule.actions.map((a) => ({
        id: newId("a"),
        type: String(a.type ?? ""),
        params: isRecord(a.params) ? { ...a.params } : {},
      })),
    },
  };
}

/** Params with empty optional values removed (the server applies defaults). */
function cleanParams(params: Json): Json {
  const out: Json = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === "" || v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

export function buildRuleBody(d: RuleDraft) {
  return {
    name: d.name.trim(),
    description: d.description.trim() || null,
    trigger: d.trigger,
    conditions: buildConditions(d.conditions),
    actions: d.actions.map((a) => ({ type: a.type, params: cleanParams(a.params) })),
  };
}

// ---------------------------------------------------------------- value editors
export type ValueEditorKind = "none" | "enum" | "enum-multi" | "number" | "date" | "bool" | "tags" | "text";

/** Which input edits a clause value, from the field type and operator. */
export function valueEditorKind(fieldType: string | undefined, op: string): ValueEditorKind {
  if (EMPTY_OPS.has(op)) return "none";
  const multi = op === "in" || op === "not_in";
  switch (fieldType) {
    case "enum":
      return multi ? "enum-multi" : "enum";
    case "int":
    case "decimal":
      return multi ? "tags" : "number";
    case "date":
      return multi ? "tags" : "date";
    case "bool":
      return "bool";
    case "list":
      return multi ? "tags" : "text";
    default:
      return multi ? "tags" : "text";
  }
}

/** A value of the right shape when the editor kind changes. */
export function coerceValue(kind: ValueEditorKind, value: unknown): unknown {
  switch (kind) {
    case "none":
      return null;
    case "enum-multi":
    case "tags":
      return Array.isArray(value) ? value.map(String) : value === null || value === "" || value === undefined ? [] : [String(value)];
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? n : 0;
    }
    case "bool":
      return typeof value === "boolean" ? value : value === "false" ? false : true;
    default:
      return Array.isArray(value) ? String(value[0] ?? "") : value === null || value === undefined ? "" : String(value);
  }
}

export const OP_LABELS: Record<string, string> = {
  eq: "is",
  ne: "is not",
  in: "is any of",
  not_in: "is none of",
  gt: "is greater than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
  contains: "contains",
  not_contains: "does not contain",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  starts_with: "starts with",
};

/** Human label for an enum value (`contract_to_hire` -> "Contract to hire"). */
export function humanize(v: string): string {
  const s = v.replace(/[_.]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fieldByPath(fields: readonly WorkflowFieldOut[], path: string): WorkflowFieldOut | undefined {
  return fields.find((f) => f.path === path);
}

// ---------------------------------------------------------------- move_stage (FR-65)
/**
 * Stages a rule may move an application to: never a human-only stage (registry
 * `move_stage_blocked_targets`), never `applied`; only custom stages and `interviewing`.
 */
export function moveStageOptions(stages: readonly PipelineStageOut[], blocked: readonly string[]): PipelineStageOut[] {
  const deny = new Set([...blocked, "applied"]);
  return stages.filter((s) => !s.archived_at && !deny.has(s.key) && (s.kind === "custom" || s.key === "interviewing"));
}

// ---------------------------------------------------------------- 422 paths
export type ErrorTarget =
  | { section: "trigger" | "name" | "conditions-root" | "actions-root" }
  | { section: "conditions"; indexes: number[] }
  | { section: "actions"; index: number; param: string | null };

/**
 * `details.path` of a 422 (`invalid_condition` / `invalid_action` / `invalid_trigger`) -> the builder part:
 * `conditions.all[1].any[0].value` -> conditions [1, 0]; `actions[2].params.title` -> action 2, param title.
 */
export function parseErrorPath(path: string): ErrorTarget | null {
  if (!path) return null;
  if (path === "trigger") return { section: "trigger" };
  if (path === "name") return { section: "name" };
  if (path.startsWith("actions")) {
    const m = /^actions\[(\d+)\](?:\.params(?:\.([A-Za-z0-9_]+))?)?/.exec(path);
    return m ? { section: "actions", index: Number(m[1]), param: m[2] ?? null } : { section: "actions-root" };
  }
  if (path.startsWith("conditions")) {
    const indexes = [...path.matchAll(/\.(?:all|any)\[(\d+)\]/g)].map((m) => Number(m[1]));
    return indexes.length ? { section: "conditions", indexes } : { section: "conditions-root" };
  }
  return null;
}

/** Row id (clause, group or action) in `draft` that a 422 path points at, if any. */
export function rowIdForError(draft: RuleDraft, path: string): string | null {
  const t = parseErrorPath(path);
  if (!t) return null;
  if (t.section === "actions") return draft.actions[t.index]?.id ?? null;
  if (t.section !== "conditions") return null;
  // buildConditions drops empty groups, so map the API index back over non-empty items.
  const visible = draft.conditions.items.filter((i) => i.kind === "clause" || i.clauses.length > 0);
  const item = visible[t.indexes[0]];
  if (!item) return null;
  if (item.kind === "group" && t.indexes.length > 1) return item.clauses[t.indexes[1]]?.id ?? item.id;
  return item.id;
}

// ---------------------------------------------------------------- test run output
export type TraceLine = { key: string; label: string; ok: boolean; actual: string; note: string | null };

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "empty";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

export function traceLines(trace: readonly Record<string, unknown>[], fields: readonly WorkflowFieldOut[]): TraceLine[] {
  return trace.map((t, i) => {
    const field = typeof t.field === "string" ? t.field : null;
    const op = typeof t.op === "string" ? t.op : "";
    const label = field
      ? `${fieldByPath(fields, field)?.label ?? field} ${OP_LABELS[op] ?? op}${EMPTY_OPS.has(op) ? "" : ` ${show(t.value)}`}`
      : String(t.note ?? t.path ?? "Condition");
    return {
      key: `${String(t.path ?? i)}:${i}`,
      label,
      ok: t.result === true,
      actual: show(t.actual),
      note: typeof t.note === "string" ? t.note : null,
    };
  });
}

export type ActionLine = { key: string; ok: boolean; text: string };

/** "Would create task …" lines, or "Would fail: transition not allowed". */
export function actionLines(results: readonly Record<string, unknown>[], actionLabels: Record<string, string>): ActionLine[] {
  return results.map((r, i) => {
    const type = String(r.type ?? "");
    const detail = typeof r.detail === "string" ? r.detail : "";
    if (r.status === "error") {
      const code = typeof r.error_code === "string" ? humanize(r.error_code).toLowerCase() : "";
      return { key: `${i}`, ok: false, text: `Would fail: ${code || detail || "error"}${code && detail ? ` (${detail})` : ""}` };
    }
    if (r.status === "would_run" || r.status === "ok") {
      return { key: `${i}`, ok: true, text: detail || `Would run: ${actionLabels[type] ?? type}` };
    }
    return { key: `${i}`, ok: true, text: detail || `${actionLabels[type] ?? type}: ${String(r.status ?? "")}` };
  });
}
