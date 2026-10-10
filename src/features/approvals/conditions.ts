/**
 * Pure (de)serialisation of approval step conditions for the chain editor.
 * API form: `{"all"|"any": [{"field", "op", "value"}]}` (null = the step always applies).
 */
import type { ChainIn, ChainOut, ChainStepIn } from "@/lib/api/types";

export const CONDITION_FIELDS = [
  "bill_rate",
  "pay_rate",
  "margin_percent",
  "positions",
  "client_id",
  "country",
  "employment_type",
] as const;
export type ConditionField = (typeof CONDITION_FIELDS)[number];

export const NUMERIC_FIELDS: readonly ConditionField[] = ["bill_rate", "pay_rate", "margin_percent", "positions"];

export const FIELD_LABELS: Record<ConditionField, string> = {
  bill_rate: "Bill rate",
  pay_rate: "Pay rate (max)",
  margin_percent: "Margin %",
  positions: "Positions",
  client_id: "Client",
  country: "Country (ISO-2)",
  employment_type: "Employment type",
};

export const CONDITION_OPS = ["eq", "ne", "gt", "gte", "lt", "lte", "in"] as const;
export type ConditionOp = (typeof CONDITION_OPS)[number];

export const OP_LABELS: Record<ConditionOp, string> = {
  eq: "equals",
  ne: "does not equal",
  gt: "greater than",
  gte: "at least",
  lt: "less than",
  lte: "at most",
  in: "is one of",
};

const ORDER_OPS: readonly ConditionOp[] = ["gt", "gte", "lt", "lte"];

/** Operators offered for a field (ordering operators need a numeric field). */
export function opsFor(field: ConditionField): ConditionOp[] {
  return NUMERIC_FIELDS.includes(field) ? [...CONDITION_OPS] : CONDITION_OPS.filter((o) => !ORDER_OPS.includes(o));
}

export type ConditionRow = { field: ConditionField; op: ConditionOp; value: string };
export type ConditionDraft = { mode: "all" | "any"; rows: ConditionRow[] };

export const EMPTY_CONDITION: ConditionDraft = { mode: "all", rows: [] };

type Clause = { field: string; op: string; value: unknown };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function valueText(v: unknown): string {
  if (Array.isArray(v)) return v.map((x) => String(x)).join(", ");
  return v === null || v === undefined ? "" : String(v);
}

/** Editor state from a stored condition (unknown fields/ops are kept out). */
export function parseCondition(condition: Record<string, unknown> | null | undefined): ConditionDraft {
  if (!isRecord(condition)) return { mode: "all", rows: [] };
  const mode = "any" in condition ? "any" : "all";
  const clauses = condition[mode];
  if (!Array.isArray(clauses)) return { mode, rows: [] };
  const rows: ConditionRow[] = [];
  for (const c of clauses as Clause[]) {
    if (!isRecord(c)) continue;
    const field = CONDITION_FIELDS.find((f) => f === c.field);
    const op = CONDITION_OPS.find((o) => o === c.op);
    if (field && op) rows.push({ field, op, value: valueText(c.value) });
  }
  return { mode, rows };
}

function coerce(field: ConditionField, text: string): string | number {
  const t = text.trim();
  if (NUMERIC_FIELDS.includes(field)) return Number(t);
  if (field === "country") return t.toUpperCase();
  return t;
}

/** Validation message for one row, or null when it is valid. */
export function rowError(row: ConditionRow): string | null {
  const parts = row.op === "in" ? row.value.split(",").map((s) => s.trim()).filter(Boolean) : [row.value.trim()];
  if (parts.length === 0 || parts.some((p) => p === "")) return "Enter a value";
  if (!opsFor(row.field).includes(row.op)) return "This operator needs a numeric field";
  if (NUMERIC_FIELDS.includes(row.field) && parts.some((p) => !Number.isFinite(Number(p)))) return "Enter a number";
  if (row.field === "country" && parts.some((p) => !/^[A-Za-z]{2}$/.test(p))) return "Use a 2-letter country code";
  return null;
}

/** API condition for the editor state (`null` when there are no rows). Call after `rowError` passes. */
export function serializeCondition(draft: ConditionDraft): Record<string, unknown> | null {
  if (draft.rows.length === 0) return null;
  return {
    [draft.mode]: draft.rows.map((r) => ({
      field: r.field,
      op: r.op,
      value:
        r.op === "in"
          ? r.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .map((s) => coerce(r.field, s))
          : coerce(r.field, r.value),
    })),
  };
}

export type ApproverKind = "user" | "role";

export type StepDraft = {
  key: string;
  name: string;
  approverKind: ApproverKind;
  approverId: string | null;
  approverLabel: string;
  condition: ConditionDraft;
};

export type ChainDraft = { name: string; subjectType: ChainIn["subject_type"]; isActive: boolean; steps: StepDraft[] };

let seq = 0;
export function newStepKey(): string {
  seq += 1;
  return `step-${seq}`;
}

export function emptyStep(): StepDraft {
  return { key: newStepKey(), name: "", approverKind: "role", approverId: null, approverLabel: "", condition: { ...EMPTY_CONDITION, rows: [] } };
}

export function chainDraft(chain?: ChainOut | null): ChainDraft {
  if (!chain) return { name: "Demand approval", subjectType: "demand", isActive: true, steps: [emptyStep()] };
  return {
    name: chain.name,
    subjectType: chain.subject_type,
    isActive: chain.is_active,
    steps: [...chain.steps]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        key: newStepKey(),
        name: s.name,
        approverKind: s.approver_user_id ? "user" : "role",
        approverId: s.approver_user_id ?? s.approver_role_id ?? null,
        approverLabel: s.approver_name ?? "",
        condition: parseCondition(s.condition),
      })),
  };
}

/** Move the item at `index` by `delta` (-1 up, +1 down); out-of-range moves return the same array. */
export function moveItem<T>(items: readonly T[], index: number, delta: number): T[] {
  const to = index + delta;
  if (index < 0 || index >= items.length || to < 0 || to >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(to, 0, item);
  return next;
}

export type ChainErrors = { name?: string; steps: Record<string, string> };

export function validateChain(d: ChainDraft): ChainErrors {
  const errors: ChainErrors = { steps: {} };
  if (!d.name.trim()) errors.name = "Enter a name";
  d.steps.forEach((s) => {
    if (!s.name.trim()) errors.steps[s.key] = "Enter a step name";
    else if (!s.approverId) errors.steps[s.key] = "Choose an approver";
    else {
      const bad = s.condition.rows.map(rowError).find(Boolean);
      if (bad) errors.steps[s.key] = `Condition: ${bad}`;
    }
  });
  return errors;
}

export function hasChainErrors(e: ChainErrors): boolean {
  return !!e.name || Object.keys(e.steps).length > 0;
}

export function buildChainIn(d: ChainDraft): ChainIn {
  return {
    name: d.name.trim(),
    subject_type: d.subjectType,
    is_active: d.isActive,
    steps: d.steps.map<ChainStepIn>((s) => ({
      name: s.name.trim(),
      approver_user_id: s.approverKind === "user" ? s.approverId : null,
      approver_role_id: s.approverKind === "role" ? s.approverId : null,
      condition: serializeCondition(s.condition),
    })),
  };
}

/** Plain-language summary of a stored condition ("Applies when bill rate at least 2000"). */
export function describeCondition(condition: Record<string, unknown> | null | undefined): string {
  const d = parseCondition(condition);
  if (d.rows.length === 0) return "Always applies";
  const joiner = d.mode === "all" ? " and " : " or ";
  return `Applies when ${d.rows.map((r) => `${FIELD_LABELS[r.field].toLowerCase()} ${OP_LABELS[r.op]} ${r.value}`).join(joiner)}`;
}
