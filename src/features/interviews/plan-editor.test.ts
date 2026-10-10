import { describe, expect, it } from "vitest";
import { moveRow, newRow, planChanged, rowsFromPlan, scheduledCount, toPlanSave, validatePlan } from "./plan";
import type { PlanOut } from "./types";

const plan: PlanOut = {
  demand_id: "d1",
  has_interviews: true,
  stages: [
    { id: "s2", position: 2, name: "Client", kind: "client", kit_id: null, kit_name: null, default_duration_minutes: 45, is_final: false, interview_counts: {} },
    { id: "s1", position: 1, name: "Technical", kind: "technical", kit_id: "k1", kit_name: "Kit", default_duration_minutes: 60, is_final: false, interview_counts: { scheduled: 2, completed: 1 } },
    { id: "s3", position: 3, name: "HR", kind: "hr", kit_id: null, kit_name: null, default_duration_minutes: 30, is_final: true, interview_counts: {} },
  ],
};

describe("interview plan editor state", () => {
  it("orders rows by position and maps the save payload", () => {
    const rows = rowsFromPlan(plan);
    expect(rows.map((r) => r.name)).toEqual(["Technical", "Client", "HR"]);
    expect(scheduledCount(rows[0])).toBe(2);
    expect(toPlanSave(rows)[0]).toEqual({ id: "s1", name: "Technical", kind: "technical", kit_id: "k1", default_duration_minutes: 60 });
    expect(planChanged(rows, plan)).toBe(false);
  });

  it("moves stages up and down within bounds", () => {
    const rows = rowsFromPlan(plan);
    expect(moveRow(rows, 1, -1).map((r) => r.id)).toEqual(["s2", "s1", "s3"]);
    expect(moveRow(rows, 2, 1).map((r) => r.id)).toEqual(["s1", "s2", "s3"]);
    expect(planChanged(moveRow(rows, 0, 1), plan)).toBe(true);
  });

  it("validates names and durations of new stages", () => {
    const row = { ...newRow(), duration: 10 };
    const errors = validatePlan([row, { ...newRow(), name: "Ok" }]);
    expect(Object.keys(errors)).toEqual([row.key]);
    expect(toPlanSave([{ ...newRow(), name: " Panel " }])[0]).toMatchObject({ id: null, name: "Panel" });
  });
});
