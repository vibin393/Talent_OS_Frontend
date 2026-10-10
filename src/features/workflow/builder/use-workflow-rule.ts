"use client";

import { useQuery } from "@tanstack/react-query";
import { workflowKeys } from "../api";
import { graphApi } from "./api";

/** A rule with its graph (stored, or derived from the Phase 1 form) and outline. */
export function useWorkflowRule(id: string | null) {
  return useQuery({
    queryKey: [...workflowKeys.rule(id ?? ""), "graph"] as const,
    queryFn: ({ signal }) => graphApi.getRule(id ?? "", signal),
    enabled: !!id,
  });
}
