/**
 * Epic 56: registers the Demand "Agent shortlist" tab and the Sourcing Agent Proposal renderers (imported once by
 * `demand-detail.tsx`).
 */
import { registerProposalRenderer } from "@/features/agent-proposals/proposal-renderers";
import { registerDemandTab } from "@/features/demands/demand-tabs";
import { AgentShortlistTab } from "./agent-shortlist-tab";
import { outreachSendRenderer, pipelineAddRenderer, sequenceEnrolRenderer } from "./renderers";

registerDemandTab({ key: "agent_shortlist", label: "Agent shortlist", permission: "match:read", order: 5, component: AgentShortlistTab });

for (const [key, renderer] of [
  ["outreach.send", outreachSendRenderer],
  ["pipeline.add_candidate", pipelineAddRenderer],
  ["sequences.enrol", sequenceEnrolRenderer],
] as const) {
  try {
    registerProposalRenderer(key, renderer);
  } catch {
    // already registered (module evaluated twice, e.g. hot reload)
  }
}
