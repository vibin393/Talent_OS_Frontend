import { describe, expect, it } from "vitest";
import { demandExtensionTabs, isDemandExtensionTabKey } from "@/features/demands/demand-tabs";
import { renderProposal } from "@/features/agent-proposals/proposal-renderers";
import {
  approvableProposalIds,
  bulkResultLines,
  contactTooltip,
  counterText,
  excludedLine,
  outreachLabel,
  reasonLabel,
  runDisabledReason,
  sourceLabel,
  visibleEntries,
} from "./logic";
import type { EntryOut, ShortlistOut } from "./types";
import "./register";

function entry(over: Partial<EntryOut>): EntryOut {
  return {
    id: "e1",
    shortlist_id: "s1",
    demand_id: "d1",
    candidate_id: "c1",
    candidate_name: "Asha Rao",
    candidate_human_id: "CAN-1",
    current_title: null,
    rank: 1,
    overall: 90,
    match_id: null,
    sources: [{ kind: "match", ref: null, label: null }],
    explanation: null,
    agent_note: null,
    flags: [],
    contactability: { email: { ok: true, reason: null } },
    best_channel: "email",
    last_activity_at: null,
    notice_period_days: null,
    availability_date: null,
    status: "suggested",
    decided_by: null,
    decided_at: null,
    dismiss_reason: null,
    application_id: null,
    draft_channel: null,
    draft_subject: null,
    draft_body: null,
    draft_status: "none",
    outreach_proposal_id: null,
    outreach_sent_at: null,
    ...over,
  };
}

function shortlist(entries: EntryOut[]): ShortlistOut {
  return {
    id: "s1",
    demand_id: "d1",
    run_id: null,
    version: 1,
    status: "current",
    trigger_key: "manual",
    considered_count: 10,
    excluded_counts: {},
    suppressed_counts: {},
    top_n: 25,
    summary: null,
    created_at: "2026-10-08T00:00:00Z",
    owner_user_id: null,
    owner_name: null,
    agent_enabled: true,
    entries,
  };
}

describe("agent shortlist logic", () => {
  it("never re-sorts: keeps the server rank order and hides dismissed unless asked", () => {
    const rows = [entry({ id: "a", rank: 1, overall: 50 }), entry({ id: "b", rank: 2, overall: 99, status: "dismissed" }), entry({ id: "c", rank: 3, overall: 80 })];
    expect(visibleEntries(shortlist(rows), false).map((e) => e.id)).toEqual(["a", "c"]);
    expect(visibleEntries(shortlist(rows), true).map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("labels reasons and channels", () => {
    expect(reasonLabel("frequency_cap")).toBe("weekly limit reached");
    expect(reasonLabel("suppressed:channel_opt_out")).toBe("opted out");
    expect(contactTooltip("email", { ok: false, reason: "frequency_cap" })).toBe("Email — Suppressed: weekly limit reached");
    expect(contactTooltip("sms", { ok: true, reason: null })).toBe("SMS: can be contacted");
    expect(sourceLabel({ kind: "pool", ref: "p", label: "Java bench" })).toBe("Java bench");
    expect(sourceLabel({ kind: "silver_medalist", ref: null, label: null })).toBe("Silver medalist");
  });

  it("shows the excluded line and the message counter", () => {
    expect(excludedLine({ in_pipeline: 2, do_not_contact: 1, archived: 3 })).toBe(
      "Excluded: 2 already in pipeline · 1 do not contact · 0 placed · 3 archived",
    );
    expect(counterText("hello")).toBe("5/4000");
    expect(runDisabledReason(false)).toBe("The Sourcing Agent is off");
    expect(runDisabledReason(true)).toBeNull();
  });

  it("derives the outreach state", () => {
    expect(outreachLabel(entry({ draft_status: "proposed", outreach_proposal_id: "p1", draft_body: "x" }))).toBe("Waiting for approval");
    expect(outreachLabel(entry({ draft_status: "proposed", draft_body: "x" }))).toBe("Draft ready");
    expect(outreachLabel(entry({ draft_status: "suppressed" }))).toBe("Suppressed");
    expect(outreachLabel(entry({}))).toBeNull();
  });

  it("selects only pending outreach Proposals for bulk approval and lists results", () => {
    const rows = [
      entry({ id: "a", draft_status: "proposed", outreach_proposal_id: "p1" }),
      entry({ id: "b", draft_status: "sent", outreach_proposal_id: "p2" }),
      entry({ id: "c", draft_status: "proposed", outreach_proposal_id: "p3" }),
    ];
    expect(approvableProposalIds(rows, new Set(["a", "b"]))).toEqual(["p1"]);
    expect(
      bulkResultLines([
        { human_id: "PRP-1", title: "t", status: "executed", error_code: null },
        { human_id: "PRP-2", title: "t", status: "execution_failed", error_code: "suppressed:frequency_cap" },
      ]),
    ).toEqual(["PRP-1: sent", "PRP-2: Not sent: weekly limit reached"]);
  });
});

describe("registration", () => {
  it("registers the Agent shortlist tab behind match:read", () => {
    expect(isDemandExtensionTabKey("agent_shortlist")).toBe(true);
    expect(demandExtensionTabs((p) => p === "match:read").map((t) => t.key)).toContain("agent_shortlist");
    expect(demandExtensionTabs(() => false).map((t) => t.key)).not.toContain("agent_shortlist");
  });

  it("renders the outreach.send Proposal as text with a suppression banner", () => {
    const out = renderProposal({
      title: "Send email",
      tool_key: "outreach.send",
      preview: {
        title: "Send email to Asha Rao: A role",
        summary: "Hi Asha",
        fields: [["Recipient", "Asha Rao"], ["Channel", "email"], ["Subject", "A role"], ["demand_id", "d1"], ["entry_id", "e1"]],
        renderer: "outreach.send",
      },
      ...({ error_code: "suppressed:frequency_cap" } as object),
    });
    expect(out.summary.startsWith("Not sent: weekly limit reached")).toBe(true);
    expect(out.rows.map((r) => r.label)).toEqual(["Recipient", "Channel", "Subject"]);
  });
});
