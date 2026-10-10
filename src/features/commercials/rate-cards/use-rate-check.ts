"use client";

import { useQuery } from "@tanstack/react-query";
import { useDebounced } from "@/lib/use-debounced";
import { commercialsApi } from "../api";
import { todayIso } from "../format";
import type { RateCheckRequest } from "../types";

export type RateCheckInput = Omit<RateCheckRequest, "on_date" | "subject_id"> & { on_date?: string; subject_id?: string | null };

/** Live (debounced) rate-card preview for a form: `POST /rate-checks/preview` (nothing is persisted).
 * Disabled until a client, bill rate, currency and unit are known. */
export function useRateCheck(input: RateCheckInput | null) {
  const debounced = useDebounced(input, 400);
  const ready = !!debounced && !!debounced.client_id && !!debounced.bill_rate && !!debounced.currency && !!debounced.rate_unit;
  return useQuery({
    queryKey: ["commercials", "rate-preview", debounced],
    queryFn: ({ signal }) =>
      commercialsApi.previewRate({ ...debounced!, subject_id: debounced!.subject_id ?? null, on_date: debounced!.on_date ?? todayIso() }, signal),
    enabled: ready,
    staleTime: 30_000,
    retry: false,
  });
}
