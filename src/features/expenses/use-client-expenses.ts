"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientExpenseKeys, clientExpensesApi } from "./api";
import type { DecideIn } from "./types";

/** Client Portal expense claims (`pending` = awaiting this user, or `all`). */
export function useClientExpenses(status: "pending" | "all") {
  return useQuery({
    queryKey: clientExpenseKeys.list(status),
    queryFn: ({ signal }) => clientExpensesApi.list(status, signal),
    retry: false,
  });
}

/** One Client Portal claim plus the (per-line) decision. */
export function useClientExpense(id: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: clientExpenseKeys.detail(id),
    queryFn: ({ signal }) => clientExpensesApi.get(id, signal),
    retry: false,
  });
  const decide = useMutation({
    mutationFn: (body: DecideIn) => clientExpensesApi.decide(id, body),
    onSuccess: (data) => {
      qc.setQueryData(clientExpenseKeys.detail(id), data);
      void qc.invalidateQueries({ queryKey: clientExpenseKeys.all });
    },
  });
  return { query, decide };
}
