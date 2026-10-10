"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingApi, billingKeys } from "./api";
import type { RunCreate } from "./types";

/** Invoice runs list + start (Idempotency-Key per wizard submission). */
export function useInvoiceRuns() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: billingKeys.runs,
    queryFn: ({ signal }) => billingApi.runs(signal),
  });
  const start = useMutation({
    mutationFn: (v: { body: RunCreate; key: string }) =>
      billingApi.createRun(v.body, v.key),
    onSuccess: () => void qc.invalidateQueries({ queryKey: billingKeys.runs }),
  });
  return { query, start };
}

/** One run: polls while queued / building; discard and batch issue refresh it. */
export function useInvoiceRun(id: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: billingKeys.run(id ?? ""),
    queryFn: ({ signal }) => billingApi.run(id as string, signal),
    enabled: Boolean(id),
    refetchInterval: (q) =>
      q.state.data &&
      (q.state.data.status === "queued" || q.state.data.status === "building")
        ? 1500
        : false,
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: billingKeys.run(id ?? "") });
    void qc.invalidateQueries({ queryKey: billingKeys.lists });
  };
  const discard = useMutation({
    mutationFn: () => billingApi.discardRun(id as string),
    onSuccess: refresh,
  });
  const issueBatch = useMutation({
    mutationFn: (v: { ids: string[]; key: string }) =>
      billingApi.issueBatch(v.ids, v.key),
    onSuccess: refresh,
  });
  return { query, discard, issueBatch };
}
