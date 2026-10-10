"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { timeApi, timeKeys, type TimesheetListFilters } from "./api";
import type { AdjustmentIn, ProxyEntriesIn, ProxySubmitIn, TimesheetDetailOut } from "./types";

/** Internal timesheet list (`GET /time/timesheets`). */
export function useTimesheets(filters: TimesheetListFilters, enabled = true) {
  return useQuery({ queryKey: timeKeys.list(filters), queryFn: ({ signal }) => timeApi.list(filters, signal), enabled });
}

/** One internal timesheet with its admin mutations. */
export function useTimesheet(id: string) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: timeKeys.detail(id), queryFn: ({ signal }) => timeApi.get(id, signal) });
  const put = (data: TimesheetDetailOut) => {
    qc.setQueryData(timeKeys.detail(id), data);
    void qc.invalidateQueries({ queryKey: timeKeys.lists });
    void qc.invalidateQueries({ queryKey: timeKeys.monitorAll });
  };
  const proxyEntries = useMutation({ mutationFn: (body: ProxyEntriesIn) => timeApi.proxyEntries(id, body), onSuccess: put });
  const submit = useMutation({ mutationFn: (body: ProxySubmitIn) => timeApi.submit(id, body), onSuccess: put });
  const reopen = useMutation({ mutationFn: (reason: string) => timeApi.reopen(id, reason), onSuccess: put });
  /** Creates a new adjustment timesheet (draft); the caller navigates to it. */
  const adjust = useMutation({
    mutationFn: (body: AdjustmentIn) => timeApi.adjust(id, body),
    onSuccess: (data) => {
      qc.setQueryData(timeKeys.detail(data.id), data);
      void qc.invalidateQueries({ queryKey: timeKeys.lists });
    },
  });
  const recordClientApproval = useMutation({
    mutationFn: (v: { file: File; clientUserId?: string; comment?: string }) =>
      timeApi.recordClientApproval(id, v.file, v.clientUserId, v.comment),
    onSuccess: put,
  });
  return { query, proxyEntries, submit, reopen, adjust, recordClientApproval };
}
