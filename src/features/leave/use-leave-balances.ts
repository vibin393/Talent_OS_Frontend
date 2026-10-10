"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { leaveApi, leaveKeys, workerLeaveApi } from "./api";
import type { AdjustBalanceIn } from "./types";

/** Internal balances + ledger of one Worker, with the audited adjustment. */
export function useLeaveBalances(candidateId: string) {
  const qc = useQueryClient();
  const balances = useQuery({ queryKey: leaveKeys.balances(candidateId), queryFn: ({ signal }) => leaveApi.balances(candidateId, signal) });
  const history = useQuery({ queryKey: leaveKeys.history(candidateId), queryFn: ({ signal }) => leaveApi.history(candidateId, signal) });
  const adjust = useMutation({
    mutationFn: (body: AdjustBalanceIn) => leaveApi.adjust(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leaveKeys.balances(candidateId) });
      void qc.invalidateQueries({ queryKey: leaveKeys.history(candidateId) });
    },
  });
  return { balances, history, adjust };
}

/** Worker "My Work" balances. */
export function useMyLeaveBalances() {
  return useQuery({ queryKey: [...leaveKeys.worker, "balances"], queryFn: ({ signal }) => workerLeaveApi.balances(signal), retry: false });
}
