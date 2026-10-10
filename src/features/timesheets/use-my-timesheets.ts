"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workerTimesheetKeys, workerTimesheetsApi } from "./api";
import type { DayEntryIn, WorkerTimesheetOut } from "./types";

/** Worker ("My Work") timesheet list. */
export function useMyTimesheets() {
  return useQuery({ queryKey: workerTimesheetKeys.list, queryFn: ({ signal }) => workerTimesheetsApi.list(signal), retry: false });
}

/** One Worker timesheet plus its mutations (save entries, copy previous, refresh prefill, submit, recall). */
export function useMyTimesheet(id: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: workerTimesheetKeys.detail(id),
    queryFn: ({ signal }) => workerTimesheetsApi.get(id, signal),
    retry: false,
  });
  const put = (data: WorkerTimesheetOut) => {
    qc.setQueryData(workerTimesheetKeys.detail(id), data);
    void qc.invalidateQueries({ queryKey: workerTimesheetKeys.list, exact: true });
  };
  const save = useMutation({ mutationFn: (days: DayEntryIn[]) => workerTimesheetsApi.saveEntries(id, days), onSuccess: put });
  const copyPrevious = useMutation({ mutationFn: () => workerTimesheetsApi.copyPrevious(id), onSuccess: put });
  const refreshPrefill = useMutation({ mutationFn: () => workerTimesheetsApi.refreshPrefill(id), onSuccess: put });
  const previewSplit = useMutation({ mutationFn: () => workerTimesheetsApi.previewSplit(id) });
  const submit = useMutation({ mutationFn: (confirmZero: boolean) => workerTimesheetsApi.submit(id, confirmZero), onSuccess: put });
  const recall = useMutation({ mutationFn: () => workerTimesheetsApi.recall(id), onSuccess: put });
  return { query, save, copyPrevious, refreshPrefill, previewSplit, submit, recall };
}
