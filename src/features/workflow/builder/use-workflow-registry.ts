"use client";

import { useQuery } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { workflowKeys } from "../api";
import { graphApi } from "./api";

/** Builder registry incl. node types, delay units, step limit, contract actions and escalation policies. */
export function useWorkflowRegistry() {
  const canRead = usePermission("workflow:read");
  return useQuery({
    queryKey: [...workflowKeys.registry, "graph"] as const,
    queryFn: ({ signal }) => graphApi.registry(signal),
    enabled: canRead,
    staleTime: 5 * 60_000,
  });
}
