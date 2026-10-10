"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { demandKeys } from "@/features/demands/api";
import { APPROVER_PERMISSIONS, hasAnyPermission } from "@/features/auth/permissions";
import { usePermissions } from "@/features/auth/use-permission";
import type { DecideIn } from "@/lib/api/types";
import { approvalKeys, approvalsApi } from "./api";

export { APPROVER_PERMISSIONS };

/** Holds an approval-related permission. Role-, user- and Finance-resolved steps need no permission, so the inbox is
 * also open to anyone with at least one pending request at their current step (see `useCanOpenApprovals`). */
export function useIsApprover(): boolean {
  return hasAnyPermission(usePermissions(), APPROVER_PERMISSIONS);
}

/** True when the Approvals inbox should be reachable: an approval permission, or something waiting on this user. */
export function useCanOpenApprovals(): { allowed: boolean; loading: boolean } {
  const isApprover = useIsApprover();
  const q = useMyApprovalsCountQuery();
  if (isApprover) return { allowed: true, loading: false };
  return { allowed: (q.data?.total ?? 0) > 0, loading: q.isPending };
}

/** `/approvals/mine` is open to every signed-in user (it only returns requests at their own current step). */
function useMyApprovalsCountQuery() {
  return useQuery({
    queryKey: approvalKeys.minePage(1, 1),
    queryFn: ({ signal }) => approvalsApi.mine(1, 1, signal),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/** Pending approval requests whose current step is the signed-in user's. */
export function useMyApprovals(page: number, pageSize: number, enabled = true) {
  return useQuery({
    queryKey: approvalKeys.minePage(page, pageSize),
    queryFn: ({ signal }) => approvalsApi.mine(page, pageSize, signal),
    enabled,
    placeholderData: (prev) => prev,
  });
}

/** Count for the nav badge (`total` of a one-item page), refreshed every minute. */
export function useMyApprovalsCount(): number {
  const q = useMyApprovalsCountQuery();
  return q.data?.total ?? 0;
}

export function useDecide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: DecideIn }) => approvalsApi.decide(id, body),
    onSuccess: async (request) => {
      await queryClient.invalidateQueries({ queryKey: approvalKeys.mine });
      // Epic 8: offer decisions change the offer's status (and its drawer / lists).
      if (request.subject_type === "offer") await queryClient.invalidateQueries({ queryKey: ["offers"] });
      if (request.subject_type === "demand") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: demandKeys.demand(request.subject_id) }),
          queryClient.invalidateQueries({ queryKey: demandKeys.lists }),
        ]);
      }
    },
  });
}
