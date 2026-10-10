"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { payrollApi, payrollKeys } from "./api";

/** Export versions of a period with preview / finalize / mark-processed / delete mutations. */
export function usePayrollVersions(periodId: string) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: payrollKeys.versions(periodId), queryFn: ({ signal }) => payrollApi.versions(periodId, signal) });
  const refresh = () => void qc.invalidateQueries({ queryKey: payrollKeys.all });
  const preview = useMutation({ mutationFn: (exclude: boolean) => payrollApi.preview(periodId, exclude), onSuccess: refresh });
  const finalize = useMutation({
    mutationFn: ({ versionId, key }: { versionId: string; key: string }) => payrollApi.finalize(versionId, key),
    onSuccess: refresh,
  });
  const markProcessed = useMutation({
    mutationFn: ({ versionId, reference }: { versionId: string; reference: string | null }) =>
      payrollApi.markProcessed(versionId, reference),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: (versionId: string) => payrollApi.deletePreview(versionId), onSuccess: refresh });
  return { query, preview, finalize, markProcessed, remove };
}

export function usePayrollRows(versionId: string | null) {
  return useQuery({
    queryKey: payrollKeys.rows(versionId ?? ""),
    queryFn: ({ signal }) => payrollApi.rows(versionId ?? "", signal),
    enabled: !!versionId,
  });
}

export function usePayrollItems(versionId: string | null, rowId: string | null) {
  return useQuery({
    queryKey: payrollKeys.items(versionId ?? "", rowId ?? ""),
    queryFn: ({ signal }) => payrollApi.items(versionId ?? "", rowId ?? "", signal),
    enabled: !!versionId && !!rowId,
  });
}
