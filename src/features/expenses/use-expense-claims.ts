"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { expenseKeys, expensesApi, workerExpenseKeys, workerExpensesApi } from "./api";
import type { ClaimFilters } from "./types";

/** Worker ("My Work") expense claims list. */
export function useMyExpenseClaims() {
  return useQuery({ queryKey: workerExpenseKeys.list, queryFn: ({ signal }) => workerExpensesApi.list(signal), retry: false });
}

/** Worker expense settings (AI receipt read toggle, upload limits). */
export function useMyExpenseSettings() {
  return useQuery({
    queryKey: workerExpenseKeys.settings,
    queryFn: ({ signal }) => workerExpensesApi.settings(signal),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

/** Claimable placements + create claim (for the "New claim" dialog). */
export function useNewExpenseClaim(enabled: boolean) {
  const qc = useQueryClient();
  const placements = useQuery({
    queryKey: workerExpenseKeys.placements,
    queryFn: ({ signal }) => workerExpensesApi.placements(signal),
    retry: false,
    enabled,
  });
  const create = useMutation({
    mutationFn: (body: { placement_id: string; title?: string | null }) => workerExpensesApi.create(body),
    onSuccess: (data) => {
      qc.setQueryData(workerExpenseKeys.detail(data.id), data);
      void qc.invalidateQueries({ queryKey: workerExpenseKeys.list });
    },
  });
  return { placements, create };
}

/** Internal claims list (`GET /expenses/claims`) and proxy claim creation. */
export function useExpenseClaims(filters: ClaimFilters, enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: expenseKeys.claimList(filters),
    queryFn: ({ signal }) => expensesApi.claims(filters, signal),
    enabled,
  });
  const createProxy = useMutation({
    mutationFn: (body: { placement_id: string; title?: string | null; proxy_reason: string }) => expensesApi.createProxy(body),
    onSuccess: (data) => {
      qc.setQueryData(expenseKeys.claim(data.id), data);
      void qc.invalidateQueries({ queryKey: expenseKeys.claims });
    },
  });
  return { query, createProxy };
}
