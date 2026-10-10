"use client";

import { ConsoleShell } from "@/features/ai-governance/console-shell";
import { ProposalInbox } from "./proposal-inbox";

/** `/admin/ai/proposals`: the inbox with `scope="all"` inside the AI governance console. */
export function GovernanceProposalsPage({ initialId = null }: { initialId?: string | null }) {
  return (
    <ConsoleShell>
      <ProposalInbox scope="all" initialId={initialId} />
    </ConsoleShell>
  );
}
