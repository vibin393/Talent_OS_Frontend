import { describe, expect, it } from "vitest";
import { renderProposal } from "@/features/agent-proposals/proposal-renderers";
import {
  agentStateLabel,
  AUTO_RULE_MESSAGE,
  canSendAutomatically,
  clientHold,
  editedDunningArgs,
  exceptionLabels,
  flagLabel,
  flagText,
  groupFlags,
  hasAiExplanation,
  invoiceHold,
  onlyEditableChanged,
  sendClassLabel,
  sendLabel,
  stepErrors,
  takeoverMessage,
} from "./logic";
import type { AgentStateOut, FlagOut, StepIn } from "./types";

function flag(over: Partial<FlagOut>): FlagOut {
  return {
    id: Math.random().toString(16).slice(2),
    timesheet_id: "t",
    placement_id: "p",
    rule: "weekend_work",
    label: "Weekend work",
    severity: "info",
    entry_dates: [],
    facts: {},
    group_key: null,
    explanation: null,
    explanation_source: "rules",
    rules_description: "4 hours logged on 1 non-working day(s).",
    status: "open",
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    timesheet_version: 1,
    created_at: "2026-10-09T00:00:00Z",
    ...over,
  };
}

const step = (over: Partial<StepIn>): StepIn => ({
  position: 1,
  offset_days: -3,
  tone: "courteous",
  audience: "billing_contacts",
  email_template_id: "tpl",
  allow_auto: false,
  create_task: false,
  active: true,
  ...over,
});

describe("timesheet flags", () => {
  it("labels every rule and falls back to the rules description", () => {
    expect(flagLabel("hours_on_leave")).toBe("Hours on approved leave");
    expect(flagLabel("duplicate_entry_pattern")).toBe("Repeated identical entries");
    expect(flagText(flag({}))).toBe("Rule: 4 hours logged on 1 non-working day(s).");
    expect(flagText(flag({ explanation: "4 hours on a Saturday." }))).toBe("4 hours on a Saturday.");
  });

  it("groups by group key, warnings first, and hides superseded flags", () => {
    const groups = groupFlags([
      flag({ rule: "weekend_work", group_key: "schedule" }),
      flag({ rule: "daily_hours_vs_schedule", group_key: "schedule" }),
      flag({ rule: "hours_on_leave", severity: "warning" }),
      flag({ rule: "zero_hours_period", status: "superseded" }),
    ]);
    expect(groups.map((g) => g.flags.map((f) => f.rule))).toEqual([["hours_on_leave"], ["daily_hours_vs_schedule", "weekend_work"]]);
  });

  it("shows the AI badge only for agent explanations", () => {
    expect(hasAiExplanation([flag({})])).toBe(false);
    expect(hasAiExplanation([flag({ explanation_source: "ai", explanation: "x" })])).toBe(true);
  });
});

describe("collection rules editor", () => {
  it("allows automatic sends only for templated pre-due courteous / friendly steps to billing contacts", () => {
    expect(canSendAutomatically(step({}))).toBe(true);
    expect(canSendAutomatically(step({ offset_days: 7 }))).toBe(false);
    expect(canSendAutomatically(step({ email_template_id: null }))).toBe(false);
    expect(canSendAutomatically(step({ tone: "firm" }))).toBe(false);
    expect(canSendAutomatically(step({ audience: "escalation_contact" }))).toBe(false);
    expect(stepErrors([step({ allow_auto: true, offset_days: 7 })])).toEqual({ 0: AUTO_RULE_MESSAGE });
    expect(stepErrors([step({ allow_auto: true })])).toEqual({});
    expect(stepErrors([step({ offset_days: 200 })])[0]).toMatch(/between -30 and 180/);
    expect(sendLabel(true)).toBe("Automatically (pre-due only)");
    expect(sendLabel(false)).toBe("After approval");
  });
});

describe("hold switch states", () => {
  const state = (holds: AgentStateOut["holds"], s: AgentStateOut["state"]): AgentStateOut => ({ client_id: "c", state: s, holds });
  const hold = (over: Partial<AgentStateOut["holds"][number]>) => ({
    id: "h", client_id: "c", document_kind: null, document_id: null, mode: "paused" as const, reason: null, created_by: null,
    created_at: "", released_at: null, released_by: null, ...over,
  });

  it("maps states and finds client / invoice holds", () => {
    expect(agentStateLabel("active")).toBe("Active");
    expect(agentStateLabel("paused")).toBe("Paused");
    expect(agentStateLabel("taken_over")).toBe("Taken over");
    const s = state([hold({}), hold({ id: "t", document_kind: "invoice", document_id: "inv", mode: "takeover" })], "paused");
    expect(clientHold(s)?.id).toBe("h");
    expect(invoiceHold(s, "inv")?.mode).toBe("takeover");
    expect(invoiceHold(s, "other")).toBeNull();
    expect(takeoverMessage("Acme", "INV-12")).toBe("You have taken over. The agent will not contact Acme about INV-12.");
    expect(sendClassLabel({ send_class: "pre_due_auto_eligible" })).toBe("Sends automatically");
    expect(sendClassLabel({ send_class: "needs_approval" })).toBe("Needs approval");
  });
});

describe("invoice run preparation and renderers", () => {
  it("labels exceptions", () => {
    expect(exceptionLabels(["po_missing", "po_cap_breach", "po_missing"])).toBe("Missing PO, PO cap reached");
    expect(exceptionLabels([])).toBe("None");
  });

  it("limits dunning edits to subject and body", () => {
    const original = { client_id: "c", document_ids: ["d"], audience: "billing_contacts", tone: "firm", subject: "s", body: "b" };
    const edited = editedDunningArgs(original, { subject: "New subject", body: "New body" });
    expect(edited.subject).toBe("New subject");
    expect(onlyEditableChanged(original, edited)).toBe(true);
    expect(onlyEditableChanged(original, { ...edited, audience: "escalation_contact" })).toBe(false);
  });

  it("renders the dunning message as plain text", () => {
    const out = renderProposal({
      tool_key: "receivables.send_dunning_message",
      title: "",
      preview: { title: "Reminder to Acme (firm)", summary: "Subject: Overdue\n\n<b>Pay</b>", fields: [["To", "Asha"]], renderer: "receivables.send_dunning_message" },
    } as never);
    expect(out.rows).toEqual([{ label: "To", value: "Asha" }, { label: "Message", value: "Subject: Overdue\n\n<b>Pay</b>" }]);
  });
});
