import { describe, expect, it } from "vitest";
import { aiBadgeLabel } from "@/components/ai/ai-badge";
import { isAgentFeature, withDefaultAiFeatures } from "@/features/ai-admin/ai-features";
import { defaultRenderer, plainText, registerProposalRenderer, renderProposal } from "./proposal-renderers";

const proposal = {
  title: "Send email",
  tool_key: "messaging.send",
  preview: { title: "Send email: Hi", summary: "Hello <b>Priya</b>\u0007", fields: [["Recipient", "candidate 1"]] as [string, string][], renderer: null },
};

describe("proposal renderers", () => {
  it("renders preview fields as plain text by default", () => {
    const out = defaultRenderer(proposal);
    expect(out.title).toBe("Send email: Hi");
    expect(out.summary).toBe("Hello <b>Priya</b>"); // text, never interpreted as HTML; control chars stripped
    expect(out.rows).toEqual([{ label: "Recipient", value: "candidate 1" }]);
  });

  it("uses a registered renderer and refuses duplicates", () => {
    registerProposalRenderer("test.tool", () => ({ title: "custom", summary: "", rows: [] }));
    expect(renderProposal({ ...proposal, tool_key: "test.tool" }).title).toBe("custom");
    expect(() => registerProposalRenderer("test.tool", defaultRenderer)).toThrow();
    expect(plainText(null)).toBe("");
  });
});

describe("AI badge and agent features", () => {
  it("labels the agent and owner", () => {
    expect(aiBadgeLabel({ agentName: "Sourcing Agent", ownerName: "Ada", mode: "suggest" })).toBe(
      "Sourcing Agent for Ada · proposed, a person decides",
    );
  });

  it("keeps agent toggles off the generic AI feature list", () => {
    expect(isAgentFeature("agentic")).toBe(true);
    expect(isAgentFeature("agent_demand")).toBe(true);
    expect(withDefaultAiFeatures({ matching: true, agentic: false, agent_copilot: true })).toEqual({
      document_extraction: false,
      matching: true,
    });
  });
});
