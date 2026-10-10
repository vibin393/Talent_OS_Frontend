"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { timeApi, timeKeys } from "./api";
import type { MonitorFilters } from "./types";

/** Timesheet monitor (FR-133) rows, per-currency totals and the remind action. */
export function useTimesheetMonitor(filters: MonitorFilters, enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: timeKeys.monitor(filters),
    queryFn: ({ signal }) => timeApi.monitor(filters, signal),
    enabled,
    placeholderData: (prev) => prev,
  });
  const remind = useMutation({
    mutationFn: (ids: string[]) => timeApi.remind(ids),
    onSuccess: () => void qc.invalidateQueries({ queryKey: timeKeys.monitorAll }),
  });
  return { query, remind };
}
