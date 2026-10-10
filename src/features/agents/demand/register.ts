/**
 * Epic 55: registers the Demand "AI assist" tab and the Demand Agent Proposal renderers (imported once by
 * `demand-detail.tsx`).
 */
import { registerProposalRenderer } from "@/features/agent-proposals/proposal-renderers";
import { registerDemandTab } from "@/features/demands/demand-tabs";
import { InsightsTab } from "./insights-tab";
import { createDraftRenderer, demandUpdateRenderer } from "./logic";

registerDemandTab({ key: "ai_assist", label: "AI assist", permission: "demand:read", order: 40, component: InsightsTab });

for (const [key, renderer] of [
  ["demands.create_draft", createDraftRenderer],
  ["demands.update", demandUpdateRenderer],
  ["demands.update_draft", demandUpdateRenderer],
] as const) {
  try {
    registerProposalRenderer(key, renderer);
  } catch {
    // already registered (module evaluated twice, e.g. hot reload)
  }
}
