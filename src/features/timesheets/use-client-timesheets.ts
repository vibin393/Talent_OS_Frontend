"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientTimesheetKeys, clientTimesheetsApi } from "./api";
import type { ClientBulkDecideIn, ClientDecideIn } from "./types";

/** Client Portal timesheet list (`pending` = awaiting this user, or `all`). */
export function useClientTimesheets(status: "pending" | "all") {
  return useQuery({
    queryKey: clientTimesheetKeys.list(status),
    queryFn: ({ signal }) => clientTimesheetsApi.list(status, signal),
    retry: false,
  });
}

/** One Client Portal timesheet plus the approve / reject decision. */
export function useClientTimesheet(id: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: clientTimesheetKeys.detail(id),
    queryFn: ({ signal }) => clientTimesheetsApi.get(id, signal),
    retry: false,
  });
  const decide = useMutation({
    mutationFn: (body: ClientDecideIn) => clientTimesheetsApi.decide(id, body),
    onSuccess: (data) => {
      qc.setQueryData(clientTimesheetKeys.detail(id), data);
      void qc.invalidateQueries({ queryKey: clientTimesheetKeys.all });
    },
  });
  return { query, decide };
}

/** Bulk preview + bulk decide (with an Idempotency-Key per confirmed action). */
export function useClientBulkDecide() {
  const qc = useQueryClient();
  const preview = useMutation({ mutationFn: (ids: string[]) => clientTimesheetsApi.bulkPreview(ids) });
  const decide = useMutation({
    mutationFn: ({ body, key }: { body: ClientBulkDecideIn; key: string }) => clientTimesheetsApi.bulkDecide(body, key),
    onSuccess: () => void qc.invalidateQueries({ queryKey: clientTimesheetKeys.all }),
  });
  return { preview, decide };
}
