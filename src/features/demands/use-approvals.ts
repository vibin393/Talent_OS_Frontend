"use client";

import { useQuery } from "@tanstack/react-query";
import { demandKeys, demandsApi } from "./api";

/** Approval requests (newest first) with their decisions for one demand. */
export function useDemandApprovals(demandId: string) {
  return useQuery({
    queryKey: demandKeys.approvals(demandId),
    queryFn: ({ signal }) => demandsApi.approvals(demandId, signal),
  });
}

export { useDecide, useMyApprovals, useMyApprovalsCount } from "@/features/approvals/use-my-approvals";
