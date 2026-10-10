import { describe, expect, it } from "vitest";
import { chainBody, chainSelection, describePolicy, emptyPolicy, isEscalationEntry, policyDraft, policyIn, validatePolicy } from "./escalation-model";
import type { EscalationPolicyOut } from "./types";

describe("escalation policy form", () => {
  it("validates targets and repeats", () => {
    const d = { ...emptyPolicy(), name: "", targetKind: "named_user" as const, repeat: true, repeatEvery: "0", maxRepeats: "9" };
    expect(validatePolicy(d)).toEqual({
      name: "Give the policy a name.",
      target: "Choose the user.",
      repeatEvery: "Enter a positive number.",
      maxRepeats: "Repeat 1 to 4 times (5 escalations at most).",
    });
    expect(validatePolicy({ ...emptyPolicy(), name: "x", afterUnit: "business_days", afterValue: "1.5" }).afterValue).toBe("Use whole business days.");
  });

  it("builds the API body and the summary", () => {
    const d = { ...emptyPolicy(), name: " Approvals ", action: "reassign" as const, repeat: true, repeatEvery: "4", maxRepeats: "2" };
    expect(policyIn(d)).toMatchObject({
      name: "Approvals",
      action: "reassign",
      target_kind: "assignee_manager",
      target_user_id: null,
      repeat_every_value: "4",
      max_repeats: 2,
    });
    expect(describePolicy(d)).toBe("Reassign to the team lead after 8 business hours, then every 4 business hours (2x more)");
    expect(describePolicy({ ...emptyPolicy(), afterValue: "1", afterUnit: "business_days" })).toBe("Notify the team lead after 1 business day");
  });

  it("loads a saved policy", () => {
    const out = {
      ...policyIn({ ...emptyPolicy(), name: "P" }),
      id: "p1",
      after_value: "1.00",
      after_unit: "business_days",
      max_repeats: 0,
      repeat_every_value: null,
    } as EscalationPolicyOut;
    expect(policyDraft(out)).toMatchObject({ afterValue: "1", afterUnit: "business_days", repeat: false });
  });
});

describe("chain-step escalation picker", () => {
  it("maps steps to positions and back", () => {
    const sel = chainSelection([{ position: 2, policy_id: "p2" }, { position: 9, policy_id: "px" }], 3);
    expect(sel).toEqual(["", "p2", ""]);
    expect(chainBody(sel)).toEqual({ steps: [{ position: 1, policy_id: null }, { position: 2, policy_id: "p2" }, { position: 3, policy_id: null }] });
  });
});

describe("escalated timeline entries", () => {
  it("recognises the escalation body", () => {
    expect(isEscalationEntry({ kind: "system", body: "Escalated to the team lead after 8 business hours (1 of 2)" })).toBe(true);
    expect(isEscalationEntry({ kind: "note", body: "Escalated to the team lead after 8 business hours (1 of 2)" })).toBe(false);
    expect(isEscalationEntry({ kind: "system", body: "Demand opened" })).toBe(false);
  });
});
