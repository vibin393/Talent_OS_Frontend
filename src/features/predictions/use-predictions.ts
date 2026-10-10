"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { usePermission, usePermissions } from "@/features/auth/use-permission";
import { isApiError } from "@/lib/api/errors";
import { predictionsApi } from "./api";
import { BATCH_LIMIT, batchBySubject, PERM_MODEL_MANAGE, PERM_READ, PERM_READ_ATTRITION, SUBJECT_KINDS } from "./logic";
import type { AnalyticsSettingsPatch, PredictionBatchItem, PredictionSubjectKind } from "./types";

export const predictionKeys = {
  all: ["predictions"] as const,
  subject: (kind: PredictionSubjectKind, id: string) => ["predictions", "subject", kind, id] as const,
  batch: (kind: PredictionSubjectKind, ids: readonly string[]) => ["predictions", "batch", kind, ids.join(",")] as const,
  models: ["predictions", "models"] as const,
  settings: ["predictions", "settings"] as const,
};

export function usePredictionPermissions() {
  return {
    canRead: usePermission(PERM_READ),
    canReadAttrition: usePermission(PERM_READ_ATTRITION),
    canManage: usePermission(PERM_MODEL_MANAGE),
  };
}

/** 403 / 404 mean "hide the panel": do not retry them. */
function retryUnlessDenied(count: number, error: unknown): boolean {
  if (isApiError(error) && (error.status === 403 || error.status === 404)) return false;
  return count < 2;
}

export function useSubjectPredictions(kind: PredictionSubjectKind, id: string, enabled = true) {
  return useQuery({
    queryKey: predictionKeys.subject(kind, id),
    queryFn: ({ signal }) => predictionsApi.forSubject(kind, id, signal),
    enabled: enabled && !!id,
    retry: retryUnlessDenied,
    staleTime: 60_000,
  });
}

/** subject_id -> batch item for a list page; empty (and no request) without `prediction:read`. */
export function usePredictionBatch(kind: PredictionSubjectKind, ids: readonly string[] | undefined) {
  const canRead = usePermission(PERM_READ);
  const permissions = usePermissions();
  const unique = useMemo(() => [...new Set(ids ?? [])].slice(0, BATCH_LIMIT), [ids]);
  const q = useQuery({
    queryKey: predictionKeys.batch(kind, unique),
    queryFn: ({ signal }) => predictionsApi.batch(kind, unique, signal),
    enabled: canRead && unique.length > 0,
    retry: retryUnlessDenied,
    staleTime: 60_000,
  });
  const map = useMemo(
    () => batchBySubject(q.data?.items ?? [], SUBJECT_KINDS[kind], permissions),
    [q.data, kind, permissions],
  );
  const result: { enabled: boolean; map: Map<string, PredictionBatchItem>; isPending: boolean } = {
    enabled: canRead,
    map,
    isPending: q.isPending && q.fetchStatus !== "idle",
  };
  return result;
}

export function useExplainPrediction() {
  return useMutation({ mutationFn: (predictionId: string) => predictionsApi.explain(predictionId) });
}

export function useModelCards(enabled = true) {
  return useQuery({ queryKey: predictionKeys.models, queryFn: ({ signal }) => predictionsApi.models(signal), enabled });
}

export function useAnalyticsSettings(enabled = true) {
  return useQuery({ queryKey: predictionKeys.settings, queryFn: ({ signal }) => predictionsApi.settings(signal), enabled });
}

export function useSaveAnalyticsSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AnalyticsSettingsPatch) => predictionsApi.saveSettings(body),
    onSuccess: (data) => {
      qc.setQueryData(predictionKeys.settings, data);
      void qc.invalidateQueries({ queryKey: predictionKeys.models });
    },
  });
}

export function useTrainModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kind: string) => predictionsApi.train(kind),
    onSuccess: () => void qc.invalidateQueries({ queryKey: predictionKeys.models }),
  });
}
