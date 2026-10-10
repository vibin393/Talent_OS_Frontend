"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { POLL_INTERVAL_MS, pollOnce, type PollState } from "./poll";

/**
 * Poll a live view every 5 s with `If-None-Match`; a 304 keeps the previous data. Polling pauses while the tab
 * is hidden (TanStack default) and resumes on focus.
 */
export function useEtagPoll<T>(queryKey: readonly unknown[], path: string, { enabled = true, intervalMs = POLL_INTERVAL_MS } = {}) {
  // Per-path poll state (data + ETag), only read and written inside the query function.
  const [states] = useState(() => new Map<string, PollState<T>>());
  return useQuery({
    queryKey: [...queryKey, path],
    queryFn: async ({ signal }) => {
      const next = await pollOnce<T>(states.get(path) ?? { data: undefined, etag: null }, path, undefined, signal);
      states.set(path, next);
      return next.data as T;
    },
    enabled,
    refetchInterval: intervalMs,
    refetchIntervalInBackground: false,
    retry: 1,
    staleTime: 0,
  });
}
