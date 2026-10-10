import { describe, expect, it } from "vitest";
import { boardQuery } from "./api";
import {
  approvable,
  blankTask,
  canWaive,
  groupTasks,
  maskedSummary,
  moveTask,
  needsRedaction,
  progressLabel,
  templateErrors,
} from "./logic";
import type { OnboardingTask } from "./types";

const t = (over: Partial<OnboardingTask>): OnboardingTask => ({
  id: Math.random().toString(36).slice(2),
  case_id: "c",
  key: "k",
  position: 0,
  kind: "personal_details",
  label: "Task",
  instructions: null,
  mandatory: true,
  assignee: "worker",
  owner_user_id: null,
  p1_task_id: null,
  due_on: null,
  source: "template",
  status: "pending",
  submitted_at: null,
  auto_approve: false,
  config: {},
  data: null,
  document_ids: [],
  signature_request_id: null,
  credential_id: null,
  return_comment: null,
  waived_reason: null,
  decided_by_kind: null,
  decided_by_id: null,
  decided_at: null,
  reused_from_task_id: null,
  overdue: false,
  ...over,
});

describe("case view helpers", () => {
  it("groups worker and internal tasks in position order", () => {
    const g = groupTasks([t({ key: "b", position: 2 }), t({ key: "laptop", assignee: "user", kind: "internal" }), t({ key: "a", position: 1 })]);
    expect(g.worker.map((x) => x.key)).toEqual(["a", "b"]);
    expect(g.internal.map((x) => x.key)).toEqual(["laptop"]);
  });

  it("knows what HR can approve and waive", () => {
    expect(approvable(t({ status: "submitted" }))).toBe(true);
    expect(approvable(t({ status: "submitted", kind: "esign" }))).toBe(false);
    expect(approvable(t({ status: "pending" }))).toBe(false);
    expect(canWaive(t({ status: "approved" }))).toBe(false);
    expect(canWaive(t({ status: "returned" }))).toBe(true);
    expect(needsRedaction(t({ config: { aadhaar: true }, data: { redaction_status: "pending_review" } }))).toBe(true);
  });

  it("shows only masked bank and PAN values", () => {
    const bank = maskedSummary(t({ kind: "bank_details", data: { last4: "9012", ifsc: "HDFC0001234" } }));
    expect(bank[0]).toEqual(["Account", "•••• 9012"]);
    const pan = maskedSummary(t({ kind: "tax_details", data: { pan_last4: "234F", regime: "new", declarations: {} } }));
    expect(pan[0]).toEqual(["PAN", "•••• 234F"]);
  });

  it("renders board progress and filters", () => {
    expect(progressLabel(66.6)).toBe("67% complete");
    expect(progressLabel(140)).toBe("100% complete");
    expect(boardQuery({ starts_within: 14, status: ["in_progress", "not_started"] })).toBe("?starts_within=14&status=in_progress&status=not_started");
    expect(boardQuery({ starts_within: null })).toBe("");
  });
});

describe("template editor", () => {
  it("validates keys, documents and owners", () => {
    const esign = { ...blankTask("esign", 0), key: "nda" };
    const internal = { ...blankTask("internal", 1), owner_kind: null };
    const errs = templateErrors("", [esign, { ...esign }, internal]);
    expect(errs.some((e) => e.includes("template name"))).toBe(true);
    expect(errs.some((e) => e.includes("used twice"))).toBe(true);
    expect(errs.some((e) => e.includes("document template"))).toBe(true);
    expect(errs.some((e) => e.includes("owner"))).toBe(true);
    expect(templateErrors("Banking", [{ ...blankTask("personal_details", 0) }])).toEqual([]);
  });

  it("never marks eSign or internal tasks reusable by default and reorders", () => {
    expect(blankTask("esign", 0).reusable).toBe(false);
    expect(blankTask("internal", 0).reusable).toBe(false);
    expect(blankTask("bank_details", 0).reusable).toBe(true);
    expect(moveTask(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveTask(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });
});
