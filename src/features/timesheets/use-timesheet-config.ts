"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { timeApi, timeKeys } from "./api";
import type { TimeConfigIn } from "./types";

/** Current timesheet config of a placement, its version history and the save mutation. */
export function usePlacementTimeConfig(placementId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: timeKeys.placementConfig(placementId),
    queryFn: ({ signal }) => timeApi.placementConfig(placementId, signal),
    retry: false,
  });
  const history = useQuery({
    queryKey: timeKeys.placementConfigHistory(placementId),
    queryFn: ({ signal }) => timeApi.placementConfigHistory(placementId, signal),
    retry: false,
  });
  const save = useMutation({
    mutationFn: (body: TimeConfigIn) => timeApi.savePlacementConfig(placementId, body),
    onSuccess: (data) => {
      qc.setQueryData(timeKeys.placementConfig(placementId), data);
      void qc.invalidateQueries({ queryKey: timeKeys.placementConfigHistory(placementId) });
    },
  });
  return { query, history, save };
}

/** Client-level timesheet defaults (tenant defaults shown until the Client has a row). */
export function useClientTimeDefaults(clientId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: timeKeys.clientDefaults(clientId),
    queryFn: ({ signal }) => timeApi.clientDefaults(clientId, signal),
    retry: false,
  });
  const save = useMutation({
    mutationFn: (body: TimeConfigIn) => timeApi.saveClientDefaults(clientId, body),
    onSuccess: (data) => qc.setQueryData(timeKeys.clientDefaults(clientId), data),
  });
  return { query, save };
}
