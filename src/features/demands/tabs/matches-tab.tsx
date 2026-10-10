"use client";

import { MatchesView } from "@/features/matching/matches-view";

/** Demand **Matches** tab (Epic 5): rediscovery funnel + ranked AI matches. */
export function MatchesTab({ demandId, onOpenPipeline }: { demandId: string; onOpenPipeline?: () => void }) {
  return <MatchesView demandId={demandId} onOpenPipeline={onOpenPipeline} />;
}
