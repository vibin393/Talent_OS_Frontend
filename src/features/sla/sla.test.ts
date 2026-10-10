import { describe, expect, it } from "vitest";
import { badgeTooltip, emptyTarget, groupTargets, hoursText, scopeText, targetDraft, targetIn, validateTarget } from "./sla-model";
import type { GenericSlaTargetOut, SlaMilestoneOut } from "./types";

const milestone: SlaMilestoneOut = {
  subject_type: "vendor_release",
  milestone: "first_submission",
  label: "First vendor submission after release",
  scope_keys: ["vendor_id"],
  calendar: "business",
  owner_epic: "17",
  available: true,
};

function target(over: Partial<GenericSlaTargetOut>): GenericSlaTargetOut {
  return {
    id: "t1",
    subject_type: "vendor_release",
    milestone: "first_submission",
    scope: {},
    priority: null,
    target_hours: "24.00",
    at_risk_percent: 75,
    calendar: "business",
    is_active: true,
    available: true,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...over,
  };
}

describe("SLA target form", () => {
  it("validates like the API", () => {
    const d = { ...emptyTarget(milestone), targetHours: "0", atRiskPercent: "100", scopeKey: "vendor_id", scopeValue: "" };
    expect(validateTarget(d, milestone)).toEqual({
      targetHours: "Enter 0.01 to 8760 hours.",
      atRiskPercent: "Enter a whole number from 1 to 99.",
      scope: "Choose the vendor.",
    });
    expect(validateTarget({ ...d, subjectType: "demand" }, milestone).milestone).toBe("Demand SLAs are set on the Demands tab.");
    expect(validateTarget({ ...d, scopeKey: "bgv_package_id", scopeValue: "x", targetHours: "24", atRiskPercent: "75" }, milestone)).toEqual({
      scope: "This scope does not apply to the milestone.",
    });
  });

  it("round-trips a target with a vendor scope and priority", () => {
    const t = target({ scope: { vendor_id: "v-1" }, priority: "high" });
    const body = targetIn(targetDraft(t));
    expect(body).toMatchObject({ scope: { vendor_id: "v-1" }, priority: "high", target_hours: "24", at_risk_percent: 75 });
  });
});

describe("SLA grid", () => {
  it("groups by subject type without demand rows", () => {
    const groups = groupTargets([
      target({ id: "a", subject_type: "timesheet", milestone: "step_decision" }),
      target({ id: "b" }),
      target({ id: "c", subject_type: "demand", milestone: "assignment" }),
    ]);
    expect(groups.map((g) => [g.label, g.rows.map((r) => r.id)])).toEqual([
      ["Timesheet", ["a"]],
      ["Vendor release", ["b"]],
    ]);
  });

  it("formats scope, hours and the badge tooltip", () => {
    expect(scopeText(target({}))).toBe("All");
    expect(scopeText(target({ scope: { vendor_id: "12345678-aaaa" } }))).toBe("Vendor: 12345678…");
    expect(hoursText("48.00")).toBe("2 days");
    expect(hoursText("8")).toBe("8 hours");
    const now = new Date("2026-10-05T10:00:00Z");
    expect(badgeTooltip("at_risk", "2026-10-05T13:00:00Z", now)).toMatch(/\(3 h left\)$/);
    expect(badgeTooltip("breached", "2026-10-05T09:00:00Z", now)).toMatch(/^Breached: was due/);
  });
});
