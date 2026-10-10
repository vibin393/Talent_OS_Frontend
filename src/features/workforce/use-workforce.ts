"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { workforceApi, workforceKeys } from "./api";
import type { GroupBy, PlanFilters } from "./types";

export function usePlans(filters: PlanFilters, enabled = true) {
  return useQuery({ queryKey: workforceKeys.list(filters), queryFn: ({ signal }) => workforceApi.list(filters, signal), enabled });
}

export function usePlan(id: string, enabled = true) {
  return useQuery({ queryKey: workforceKeys.detail(id), queryFn: ({ signal }) => workforceApi.get(id, signal), enabled });
}

export function usePlanLines(id: string, revision: number | undefined, enabled = true) {
  return useQuery({
    queryKey: workforceKeys.lines(id, revision),
    queryFn: ({ signal }) => workforceApi.lines(id, revision, signal),
    enabled,
  });
}

export function usePlanRevisions(id: string, enabled = true) {
  return useQuery({ queryKey: workforceKeys.revisions(id), queryFn: ({ signal }) => workforceApi.revisions(id, signal), enabled });
}

export function useRevisionDiff(id: string, n: number | null) {
  return useQuery({
    queryKey: workforceKeys.diff(id, n ?? 0),
    queryFn: ({ signal }) => workforceApi.diff(id, n ?? 0, signal),
    enabled: n !== null,
  });
}

export function usePlanSlots(id: string, status: string) {
  return useQuery({
    queryKey: workforceKeys.slots(id, status),
    queryFn: ({ signal }) => workforceApi.slots(id, status || undefined, signal),
  });
}

export function usePlanActuals(id: string, groupBy: GroupBy) {
  return useQuery({ queryKey: workforceKeys.actuals(id, groupBy), queryFn: ({ signal }) => workforceApi.actuals(id, groupBy, signal) });
}

export function useWorkforceSettings(enabled = true) {
  return useQuery({ queryKey: workforceKeys.settings, queryFn: ({ signal }) => workforceApi.settings(signal), enabled });
}

/** Refetch everything the workforce UI shows. */
export function useRefreshWorkforce() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: workforceKeys.all }), [qc]);
}
