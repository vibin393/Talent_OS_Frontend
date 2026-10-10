/** Pure editing state for the demand interview plan (ordered stages). */
import type { PlanOut, PlanStageIn, StageKind } from "./types";

/** Epic 40: a stage can also be an "assessment" stage (with `assessment_id`); not yet in the generated schema. */
export type PlanStageKind = StageKind | "assessment";
export type PlanStageSave = Omit<PlanStageIn, "kind"> & { kind: PlanStageKind; assessment_id?: string | null };

export type PlanRow = {
  key: string;
  id: string | null;
  name: string;
  kind: PlanStageKind;
  kitId: string | null;
  /** Published assessment for an "assessment" stage (Epic 40). */
  assessmentId?: string | null;
  duration: number;
  /** Interviews already in this stage by status (existing stages only). */
  counts: Record<string, number>;
};

let tmp = 0;
export function newRow(duration = 60): PlanRow {
  tmp += 1;
  return { key: `new-${tmp}`, id: null, name: "", kind: "other", kitId: null, duration, counts: {} };
}

export function rowsFromPlan(plan: PlanOut | undefined): PlanRow[] {
  return (plan?.stages ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      key: s.id,
      id: s.id,
      name: s.name,
      kind: s.kind as PlanStageKind,
      kitId: s.kit_id,
      assessmentId: (s as { assessment_id?: string | null }).assessment_id ?? null,
      duration: s.default_duration_minutes,
      counts: s.interview_counts ?? {},
    }));
}

/** Move the row at `index` by `delta` (-1 up, +1 down); out-of-range moves return the same list. */
export function moveRow(rows: readonly PlanRow[], index: number, delta: number): PlanRow[] {
  const target = index + delta;
  if (index < 0 || index >= rows.length || target < 0 || target >= rows.length) return [...rows];
  const next = [...rows];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function toPlanSave(rows: readonly PlanRow[]): PlanStageSave[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name.trim(),
    kind: r.kind,
    kit_id: r.kitId,
    default_duration_minutes: r.duration,
    ...(r.kind === "assessment" ? { assessment_id: r.assessmentId ?? null } : {}),
  }));
}

export function validatePlan(rows: readonly PlanRow[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const r of rows) {
    if (!r.name.trim()) errors[r.key] = "Name the stage";
    else if (!Number.isInteger(r.duration) || r.duration < 15 || r.duration > 480) errors[r.key] = "Duration must be 15–480 minutes";
    else if (r.kind === "assessment" && !r.assessmentId) errors[r.key] = "Choose a published assessment";
  }
  return errors;
}

export function planChanged(rows: readonly PlanRow[], plan: PlanOut | undefined): boolean {
  return JSON.stringify(toPlanSave(rows)) !== JSON.stringify(toPlanSave(rowsFromPlan(plan)));
}

/** Scheduled interviews in a stage (removing it is refused by the server). */
export function scheduledCount(row: PlanRow): number {
  return row.counts.scheduled ?? 0;
}

/** Total interviews in a stage (a stage with any is archived rather than deleted on removal). */
export function totalCount(row: PlanRow): number {
  return Object.values(row.counts).reduce((a, b) => a + b, 0);
}
