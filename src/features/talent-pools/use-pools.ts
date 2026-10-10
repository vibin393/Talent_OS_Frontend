"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAppToast } from "@/components/toast";
import { errorMessage } from "@/lib/api/errors";
import { poolKeys, poolsApi } from "./api";
import type { PoolListParams, PoolOut } from "./types";

export function usePools(params: PoolListParams, enabled = true) {
  return useQuery({
    queryKey: poolKeys.list(params),
    queryFn: ({ signal }) => poolsApi.list(params, signal),
    enabled,
  });
}

export function usePool(id: string, enabled = true) {
  return useQuery({
    queryKey: poolKeys.detail(id),
    queryFn: ({ signal }) => poolsApi.get(id, signal),
    enabled,
  });
}

/** Refetch everything the talent pools UI shows. */
export function useInvalidatePools() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: poolKeys.all }), [qc]);
}

/** Subscribe to / unsubscribe from a pool's daily digest. */
export function useToggleSubscription() {
  const toast = useAppToast();
  const invalidate = useInvalidatePools();
  return useMutation({
    mutationFn: ({ pool, on }: { pool: Pick<PoolOut, "id">; on: boolean }) =>
      on ? poolsApi.subscribe(pool.id) : poolsApi.unsubscribe(pool.id),
    onSuccess: (r) => toast.success(r.subscribed ? "Subscribed to the daily digest." : "Unsubscribed from the digest."),
    onError: (e) => toast.error(errorMessage(e, "Could not change the subscription.")),
    onSettled: () => invalidate(),
  });
}
