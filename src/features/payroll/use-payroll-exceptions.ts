"use client";

import { useQuery } from "@tanstack/react-query";
import { payrollApi, payrollKeys } from "./api";

/** Pre-run exception list of a pay period (unapproved timesheets, missing rates / bank details, currency). */
export function usePayrollExceptions(periodId: string, enabled = true) {
  return useQuery({
    queryKey: payrollKeys.exceptions(periodId),
    queryFn: ({ signal }) => payrollApi.exceptions(periodId, signal),
    enabled,
  });
}
