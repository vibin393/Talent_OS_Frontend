"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type BenchFilters, benchApi, benchKeys } from "./api";
import type { BenchEntryCreate, BenchEntryUpdate, ReleaseReason } from "./types";

export function useBenchEntries(filters: BenchFilters, enabled = true) {
  return useQuery({
    queryKey: benchKeys.list(filters),
    queryFn: ({ signal }) => benchApi.list(filters, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useBenchEntry(id: string | null) {
  return useQuery({
    queryKey: benchKeys.detail(id ?? ""),
    queryFn: ({ signal }) => benchApi.get(id ?? "", signal),
    enabled: !!id,
  });
}

/** Mutations of one entry; every success invalidates `bench-entries` (list + detail) and the summary. */
export function useBenchEntryMutations() {
  const qc = useQueryClient();
  const done = () => {
    void qc.invalidateQueries({ queryKey: benchKeys.all });
    void qc.invalidateQueries({ queryKey: ["bench-summary"] });
  };
  return {
    create: useMutation({ mutationFn: (body: BenchEntryCreate) => benchApi.create(body), onSuccess: done }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: BenchEntryUpdate }) => benchApi.update(id, body),
      onSuccess: done,
    }),
    overrideCost: useMutation({
      mutationFn: ({ id, cost, currency }: { id: string; cost: string; currency: string }) => benchApi.overrideCost(id, cost, currency),
      onSuccess: done,
    }),
    release: useMutation({
      mutationFn: ({ id, reason, note }: { id: string; reason: ReleaseReason; note: string | null }) => benchApi.release(id, reason, note),
      onSuccess: done,
    }),
  };
}
