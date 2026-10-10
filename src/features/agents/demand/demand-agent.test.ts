import { describe, expect, it } from "vitest";
import {
  canAssign,
  canDiscard,
  canRetry,
  createDraftRenderer,
  demandAgentOn,
  demandUpdateRenderer,
  domainError,
  fromPercent,
  toPercent,
  duplicateBannerText,
  INTAKE_STATUS_LABELS,
  INTAKE_TABS,
  isNewSkill,
  linkSuggestions,
  NEEDS_ATTENTION,
  openDuplicateFlags,
  senderLabel,
  skillKindLabel,
  skillSuggestions,
  slaBasisText,
} from "./logic";
import type { DemandFlag, Suggestion } from "./types";

function flag(over: Partial<DemandFlag> = {}): DemandFlag {
  return {
    id: "f1",
    demand_id: "d1",
    demand_human_id: "REQ-1042",
    kind: "possible_duplicate",
    status: "open",
    score: "0.88",
    reasons: [
      { field: "title", detail: "same title" },
      { field: "skills", detail: "4 of 5 skills" },
      { field: "hiring_contact", detail: "same hiring contact" },
    ],
    summary: null,
    milestone: null,
    basis: null,
    p_late: null,
    next_steps: [],
    related: { related_visible: true, demand_id: "d2", human_id: "REQ-1041", title: "Senior Data Engineer", status: "open" },
    raised_by_kind: "agent",
    run_id: null,
    created_at: "2026-10-08T00:00:00Z",
    resolved_at: null,
    resolution_note: null,
    ...over,
  };
}

function suggestion(kind: Suggestion["kind"], status: Suggestion["status"] = "pending"): Suggestion {
  return { id: kind, kind, payload: { label: kind }, status, created_at: "", decided_at: null };
}

describe("intake inbox", () => {
  it("has the three tabs and the badge labels", () => {
    expect(INTAKE_TABS.map((t) => t.label)).toEqual(["Needs attention", "Drafted", "All"]);
    expect(INTAKE_STATUS_LABELS.unmatched).toBe("Unmatched");
    expect(INTAKE_STATUS_LABELS.blocked).toBe("Blocked (unsafe file)");
    expect(INTAKE_STATUS_LABELS.no_roles).toBe("No roles found");
    expect(INTAKE_STATUS_LABELS.processing).toBe("Processing");
    expect(NEEDS_ATTENTION).toEqual(["unmatched", "ambiguous", "failed", "blocked", "no_roles"]);
  });

  it("offers Assign client only for unmatched / ambiguous, Retry for failed / no roles with a client", () => {
    expect(canAssign("unmatched") && canAssign("ambiguous")).toBe(true);
    expect(canAssign("drafted")).toBe(false);
    expect(canRetry("failed", "c1") && canRetry("no_roles", "c1")).toBe(true);
    expect(canRetry("failed", null)).toBe(false);
    expect(canDiscard("processing")).toBe(false);
    expect(canDiscard("unmatched")).toBe(true);
  });

  it("formats the sender", () => {
    expect(senderLabel("Priya", "priya@acme.com")).toBe("Priya <priya@acme.com>");
    expect(senderLabel(null, null)).toBe("Unknown sender");
  });
});

describe("duplicate banner", () => {
  it("names the visible related demand with the reasons", () => {
    expect(duplicateBannerText(flag())).toBe("REQ-1041 looks similar: same title, 4 of 5 skills, same hiring contact.");
  });

  it("never shows a demand the viewer can't read", () => {
    const hidden = flag({ related: { related_visible: false, demand_id: null, human_id: null, title: null, status: null } });
    expect(duplicateBannerText(hidden)).toBe("Similar to a demand you can't see. Ask your manager.");
    expect(duplicateBannerText(hidden)).not.toContain("REQ-1041");
  });

  it("shows only open duplicate flags", () => {
    expect(openDuplicateFlags([flag(), flag({ id: "f2", status: "distinct" }), flag({ id: "f3", kind: "sla_risk" })])).toHaveLength(1);
  });
});

describe("AI assist tab", () => {
  it("splits skill and link suggestions and marks new skills", () => {
    const items = [suggestion("skill"), suggestion("new_skill"), suggestion("contract"), suggestion("rate_card", "accepted")];
    expect(skillSuggestions(items).map((s) => s.kind)).toEqual(["skill", "new_skill"]);
    expect(linkSuggestions(items).map((s) => s.kind)).toEqual(["contract"]);
    expect(isNewSkill(items[1])).toBe(true);
    expect(skillKindLabel("preferred")).toBe("Nice to have");
    expect(skillKindLabel("mandatory")).toBe("Must have");
  });

  it("explains the SLA basis", () => {
    expect(slaBasisText({ basis: "prediction", basis_text: "", p_late: "0.68" })).toBe(
      "Based on the time-to-fill prediction (68% likely to miss)",
    );
    expect(slaBasisText({ basis: "pipeline_only", basis_text: "", p_late: null })).toBe(
      "Based on pipeline progress only (no time-to-fill model)",
    );
    expect(slaBasisText({ basis: "late", basis_text: "Server text", p_late: null })).toBe("Server text");
  });
});

describe("intake settings", () => {
  it("validates the sender domain and refuses public webmail", () => {
    expect(domainError("acme.com")).toBeNull();
    expect(domainError("@Acme.co.in")).toBeNull();
    expect(domainError("gmail.com")).toBe("Public email domains (such as gmail.com) can't identify a client");
    expect(domainError("not a domain")).toBe("Enter a domain such as acme.com");
    expect(domainError("")).toBe("Enter a domain");
  });

  it("converts thresholds", () => {
    expect(toPercent("0.72")).toBe(72);
    expect(fromPercent(72, 50, 95)).toBe("0.72");
    expect(fromPercent(20, 50, 95)).toBe("0.50");
  });

  it("detects the agent switch", () => {
    expect(demandAgentOn({ agentic: true, agent_demand: true })).toBe(true);
    expect(demandAgentOn({ agentic: true, agent_demand: false })).toBe(false);
    expect(demandAgentOn(undefined)).toBe(false);
  });
});

describe("proposal renderers", () => {
  it("labels the draft fields and hides the demand id row on updates", () => {
    const draft = createDraftRenderer({
      title: "t",
      tool_key: "demands.create_draft",
      preview: { title: "Create draft demand: Data Engineer for Acme", summary: "s", fields: [["positions", "3"]], renderer: null },
    } as never);
    expect(draft.rows).toEqual([{ label: "Positions", value: "3" }]);
    const update = demandUpdateRenderer({
      title: "t",
      tool_key: "demands.update",
      preview: { title: "Update REQ-1", summary: "New JD", fields: [["demand_id", "d1"], ["Skills added", "Kafka"]], renderer: null },
    } as never);
    expect(update.rows).toEqual([{ label: "Skills added", value: "Kafka" }]);
  });
});
