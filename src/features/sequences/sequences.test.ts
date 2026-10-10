import { describe, expect, it } from "vitest";
import { enrolSummary, refusalCounts } from "./enrol-logic";
import {
  addStep,
  branchTargets,
  defaultStep,
  hasErrors,
  MAX_STEPS,
  moveStep,
  removeStep,
  stepsFromServer,
  stepsToPayload,
  stepSummary,
  validateSteps,
} from "./logic";
import type { StepDraft } from "./types";

const send = (subject = "Hello"): StepDraft => ({ kind: "send", config: { channel: "email", subject, body_html: "<p>Hi</p>", job_links: [] } });
const wait = (days: number): StepDraft => ({ kind: "wait", config: { days } });
const branch = (then_position: number | null, else_position: number | null): StepDraft => ({
  kind: "branch",
  config: { on: "opened", within_days: 3, then_position, else_position },
});

describe("step graph validation", () => {
  it("accepts a valid 4-step sequence with a forward branch", () => {
    const steps = [send(), wait(3), branch(4, 5), send("Follow up"), send("Last call")];
    expect(hasErrors(validateSteps(steps))).toBe(false);
  });

  it("rejects backward, self and missing branch targets", () => {
    expect(validateSteps([send(), wait(2), branch(1, 4), send()]).steps[2]).toEqual(['"Then" must go to a later step.']);
    expect(validateSteps([send(), branch(2, 3), send()]).steps[1]).toEqual(['"Then" must go to a later step.']);
    expect(validateSteps([send(), branch(3, 9), send()]).steps[1]).toEqual(['"Else" points to a step that does not exist.']);
    expect(validateSteps([send(), branch(null, 3), send()]).steps[1]).toEqual(['Choose the "Then" step.']);
  });

  it("bounds wait days to 1..90", () => {
    expect(validateSteps([wait(1)]).steps[0]).toBeUndefined();
    expect(validateSteps([wait(90)]).steps[0]).toBeUndefined();
    expect(validateSteps([wait(0)]).steps[0]).toEqual(["Wait 1 to 90 days."]);
    expect(validateSteps([wait(91)]).steps[0]).toEqual(["Wait 1 to 90 days."]);
    expect(validateSteps([wait(1.5)]).steps[0]).toBeDefined();
  });

  it("allows at most 20 steps", () => {
    const twenty = Array.from({ length: MAX_STEPS }, () => wait(1));
    expect(validateSteps(twenty).form).toEqual([]);
    expect(validateSteps([...twenty, wait(1)]).form).toEqual(["A sequence can have at most 20 steps."]);
    expect(addStep(twenty, "wait")).toBe(twenty);
    expect(addStep([], "task")).toHaveLength(1);
  });

  it("requires content for sends, tasks and pools", () => {
    const v = validateSteps([
      { kind: "send", config: { channel: "sms", channel_template_id: null } },
      { kind: "send", config: { channel: "email", subject: "", body_html: "" } },
      defaultStep("task"),
      defaultStep("add_to_pool"),
    ]);
    expect(v.steps[0]).toEqual(["Choose a registered template."]);
    expect(v.steps[1]).toEqual(["Enter a subject.", "Enter the email body."]);
    expect(v.steps[2]).toEqual(["Enter a task title."]);
    expect(v.steps[3]).toEqual(["Choose a talent pool."]);
  });
});

describe("step list editing", () => {
  it("keeps branch targets on the same steps when reordering", () => {
    const steps = [branch(3, 4), wait(1), send("A"), send("B")];
    const moved = moveStep(steps, 3, 1); // B moves to position 2
    expect(moved.map((s) => s.kind)).toEqual(["branch", "send", "wait", "send"]);
    expect(moved[0].config).toMatchObject({ then_position: 4, else_position: 2 });
  });

  it("clears targets of a removed step and shifts later ones", () => {
    const steps = [branch(3, 4), wait(1), send("A"), send("B")];
    const after = removeStep(steps, 2);
    expect(after).toHaveLength(3);
    expect(after[0].config).toMatchObject({ then_position: null, else_position: 3 });
  });

  it("lists only later steps as branch targets", () => {
    expect(branchTargets(2, 5)).toEqual([3, 4, 5]);
    expect(branchTargets(5, 5)).toEqual([]);
  });

  it("round-trips server steps and builds the payload per channel", () => {
    const drafts = stepsFromServer([
      { id: "2", position: 2, kind: "wait", config: { days: 4 } },
      { id: "1", position: 1, kind: "send", config: { channel: "whatsapp", channel_template_id: "t1" } },
      { id: "3", position: 3, kind: "branch", config: { on: "clicked", within_days: 2, then_position: 4, else_position: null } },
    ]);
    expect(drafts.map((d) => d.kind)).toEqual(["send", "wait", "branch"]);
    expect(stepsToPayload(drafts)[0]).toEqual({ kind: "send", config: { channel: "whatsapp", channel_template_id: "t1" } });
    expect(stepsToPayload([send(" Hi ")])[0].config).toEqual({ channel: "email", subject: "Hi", body_html: "<p>Hi</p>", job_links: [] });
    expect(stepSummary(drafts[1])).toBe("Wait 4 days");
    expect(stepSummary(drafts[2])).toBe("If clicked within 2 days, go to step 4, else step ?");
  });
});

describe("enrol results", () => {
  it("groups refusals by reason", () => {
    const refused = [
      { candidate_id: "a", reason: "already_enrolled" },
      { candidate_id: "b", reason: "re_enrol_gap" },
      { candidate_id: "c", reason: "already_enrolled" },
    ];
    expect(refusalCounts(refused)).toEqual([
      { reason: "already_enrolled", label: "Already enrolled", count: 2 },
      { reason: "re_enrol_gap", label: "Enrolled too recently", count: 1 },
    ]);
    expect(enrolSummary({ enrolled: 5, refused })).toBe("5 enrolled, 3 not enrolled");
    expect(enrolSummary({ enrolled: 2, refused: [] })).toBe("2 enrolled");
  });
});
