"use client";

import { useQuery } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { demandAgentApi, demandAgentKeys } from "./api";

/** Epic 55: field -> verbatim source quote of a demand's AI-extracted fields (for the "AI-extracted" tooltip). */
export function useFieldSources(demandId: string, enabled: boolean): Record<string, string> {
  const canRead = usePermission("demand:read");
  const query = useQuery({
    queryKey: demandAgentKeys.insights(demandId),
    queryFn: ({ signal }) => demandAgentApi.insights(demandId, signal),
    enabled: enabled && canRead,
    retry: false,
    staleTime: 60_000,
  });
  return Object.fromEntries((query.data?.field_sources ?? []).map((s) => [s.field, s.source_quote]));
}
