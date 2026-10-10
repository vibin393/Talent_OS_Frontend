"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { marketingApi, marketingKeys } from "./api";
import type { PickerOption } from "./types";

export function useMarketingSettings(enabled = true) {
  return useQuery({ queryKey: marketingKeys.settings, queryFn: ({ signal }) => marketingApi.settings(signal), enabled });
}

export function useMarketingOptions(enabled = true) {
  return useQuery({
    queryKey: marketingKeys.options,
    queryFn: ({ signal }) => marketingApi.options(signal),
    enabled,
    staleTime: 60_000,
  });
}

/** Refetch everything the marketing UI shows. */
export function useInvalidateMarketing() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: marketingKeys.all }), [qc]);
}

export function optionLabel(o: PickerOption): string {
  return o.detail ? `${o.name} (${o.detail})` : o.name;
}
