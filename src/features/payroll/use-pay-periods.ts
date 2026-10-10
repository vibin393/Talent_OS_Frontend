"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { payrollApi, payrollKeys } from "./api";

/** Pay periods of a Legal Entity (or all when `le` is null). */
export function usePayPeriods(le: string | null, enabled = true) {
  return useQuery({ queryKey: payrollKeys.periods(le), queryFn: ({ signal }) => payrollApi.periods(le, signal), enabled });
}

/** One pay period plus its reopen mutation (Finance Admin, reason required). */
export function usePayPeriod(id: string) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: payrollKeys.period(id), queryFn: ({ signal }) => payrollApi.period(id, signal) });
  const reopen = useMutation({
    mutationFn: (reason: string) => payrollApi.reopen(id, reason),
    onSuccess: (data) => {
      qc.setQueryData(payrollKeys.period(id), data);
      void qc.invalidateQueries({ queryKey: payrollKeys.all });
    },
  });
  return { query, reopen };
}
