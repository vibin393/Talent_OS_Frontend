"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { expenseKeys, expensesApi } from "./api";
import type { ExpenseSettingsUpdate, PolicyCreateIn, PolicyVersionIn } from "./types";

/** Expense policies (latest version per scope / client) with create + new-version mutations. */
export function useExpensePolicies(enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: expenseKeys.policies, queryFn: ({ signal }) => expensesApi.policies(signal), enabled });
  const invalidate = () => void qc.invalidateQueries({ queryKey: expenseKeys.policies });
  const create = useMutation({ mutationFn: (body: PolicyCreateIn) => expensesApi.createPolicy(body), onSuccess: invalidate });
  const newVersion = useMutation({
    mutationFn: ({ id, body }: { id: string; body: PolicyVersionIn }) => expensesApi.newPolicyVersion(id, body),
    onSuccess: invalidate,
  });
  return { query, create, newVersion };
}

/** A specific policy version (`version` undefined = latest). */
export function useExpensePolicy(id: string | null, version?: number) {
  return useQuery({
    queryKey: expenseKeys.policy(id ?? "", version),
    queryFn: ({ signal }) => expensesApi.policy(id ?? "", version, signal),
    enabled: !!id && version !== undefined,
  });
}

/** Tenant expense settings (AI receipt read, duplicate window, max receipt size). */
export function useExpenseSettings(enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: expenseKeys.settings, queryFn: ({ signal }) => expensesApi.settings(signal), enabled });
  const update = useMutation({
    mutationFn: (body: ExpenseSettingsUpdate) => expensesApi.updateSettings(body),
    onSuccess: (data) => qc.setQueryData(expenseKeys.settings, data),
  });
  return { query, update };
}
