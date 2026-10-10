"use client";

import { useQuery } from "@tanstack/react-query";
import { benchApi, benchKeys } from "./api";

export function useBenchSummary(months = 6, enabled = true) {
  return useQuery({ queryKey: benchKeys.summary(months), queryFn: ({ signal }) => benchApi.summary(months, signal), enabled });
}

export function useRollOffs(within: 30 | 60, enabled = true) {
  return useQuery({ queryKey: benchKeys.rollOffs(within), queryFn: ({ signal }) => benchApi.rollOffs(within, signal), enabled });
}
