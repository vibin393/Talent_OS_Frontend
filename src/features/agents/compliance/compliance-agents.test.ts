import { describe, expect, it } from "vitest";
import { renderProposal } from "@/features/agent-proposals/proposal-renderers";
import { complianceAgentKeys, riskQuery } from "./api";
import { chaseLine, followUpLine, limitReached, portalSeen, runStartedMessage, suppressedText } from "./logic";
import type { ChaseOut, FollowUpOut, OverdueCheckOut, RiskRow } from "./types";

const chase: ChaseOut = {
  id: "c1", candidate_id: "w1", placement_id: "p1", item_kind: "checklist_item", item_ref: "i1", item_label: "PAN card",
  due_basis: "start_date", due_on: "2026-10-20", offset_days: 7, channels: ["portal", "email"],
  suppressed: [{ channel: "sms", reason: "opted_out" }], escalated: true, task_id: "t1", escalated_to_name: "Ada",
  agent_run_id: "r1", sent_at: "2026-10-13T09:00:00Z",
};

const row = (over: Partial<RiskRow> = {}): RiskRow => ({
  placement_id: "p1", placement_ref: null, candidate_id: "w1", worker_name: "Priya", client_id: "c1", client_name: "Acme",
  start_date: "2026-10-20", days_to_start: 7, status: "pre_joining", missing_items: [{ label: "PAN card", status: "missing", kind: "document" }],
  last_contact: null, portal_last_seen: null, chases_sent: 0, escalation_task_id: null, escalated: false, bgv_status: null, ...over,
});

describe("compliance chasing display", () => {
  it("describes a chase with items, channels and the cadence offset", () => {
    expect(chaseLine(chase)).toContain("PAN card · portal, email · 7 days before start");
    expect(chaseLine({ ...chase, offset_days: -3, due_basis: "expiry" })).toContain("3 days after expiry");
  });

  it("explains suppressed channels", () => {
    expect(suppressedText({ channel: "sms", reason: "opted_out" })).toBe("SMS not sent: opted out");
    expect(suppressedText({ channel: "whatsapp", reason: "no_template" })).toBe("WhatsApp not sent: no approved template");
  });

  it("warns when the portal was never opened (risk list state)", () => {
    expect(portalSeen(row())).toEqual({ text: "Never", warn: true });
    expect(portalSeen(row({ portal_last_seen: "2026-10-10T10:00:00Z" })).warn).toBe(false);
  });

  it("builds the risk query and keys", () => {
    expect(riskQuery({ days: 7, clientId: "c1", escalatedOnly: true })).toBe("days=7&client_id=c1&escalated_only=true");
    expect(riskQuery({ days: 14 })).toBe("days=14");
    expect(complianceAgentKeys.bgv("x")).toEqual(["compliance-agent", "bgv-follow-ups", "x"]);
  });

  it("explains a run that could not start", () => {
    expect(runStartedMessage({ run_id: "r", status: "queued", reason: null }, "Compliance Agent").intent).toBe("success");
    expect(runStartedMessage({ run_id: null, status: "not_started", reason: "feature_off" }, "BGV Agent").text).toBe("The BGV Agent is not enabled.");
  });
});

describe("BGV follow-ups display", () => {
  const f: FollowUpOut = {
    id: "f", check_id: "k", check_type: "employment", check_label: "Employment 1", provider_name: "VerifyCo", channel: "email",
    seq: 2, status: "sent", provider_status: null, days_overdue: 4, sent_at: "2026-10-13T09:00:00Z",
  };
  it("shows email follow-ups and connector status requests", () => {
    expect(followUpLine(f, 5)).toContain("Employment 1 · VerifyCo · 4 days overdue · Follow-up 2 of 5 sent");
    expect(followUpLine({ ...f, channel: "connector", provider_status: "in_progress" }, 5)).toBe(
      "Employment 1 · Status requested via connector: in_progress",
    );
  });
  it("detects the follow-up limit", () => {
    const o = { limit_reached: true } as OverdueCheckOut;
    expect(limitReached([o])).toBe(true);
    expect(limitReached([])).toBe(false);
  });
});

describe("Epic 62 proposal renderers", () => {
  it("renders the custom-note reminder and the provider message as plain text", () => {
    const reminder = renderProposal({
      tool_key: "compliance.send_chase_reminder", title: "",
      preview: { title: "", summary: "Templated reminder", fields: [["Personal note", "Bring the original"]], renderer: null },
    } as never);
    expect(reminder.title).toBe("Send a document reminder");
    expect(reminder.rows).toEqual([{ label: "Personal note", value: "Bring the original" }]);
    const message = renderProposal({
      tool_key: "bgv.draft_provider_message", title: "",
      preview: { title: "Email the BGV provider: Status", summary: "<b>Any update?</b>", fields: [["Check", "Employment 1"]], renderer: null },
    } as never);
    expect(message.rows.at(-1)).toEqual({ label: "Message", value: "<b>Any update?</b>" });
    const docs = renderProposal({ tool_key: "bgv.request_candidate_documents", title: "", preview: { title: "", summary: "", fields: [] } } as never);
    expect(docs.title).toBe("Request documents from the candidate");
  });
});
