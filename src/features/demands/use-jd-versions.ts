"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type { JdKind, PostingIn } from "@/lib/api/types";
import { demandKeys, demandsApi } from "./api";
import { useInvalidateDemand } from "./use-demand";

export function useJdVersions(demandId: string) {
  return useQuery({
    queryKey: demandKeys.jd(demandId),
    queryFn: ({ signal }) => demandsApi.jdVersions(demandId, signal),
  });
}

export function usePosting(demandId: string) {
  return useQuery({
    queryKey: demandKeys.posting(demandId),
    queryFn: ({ signal }) => demandsApi.posting(demandId, signal),
  });
}

function useJdMutation<V, R>(demandId: string, fn: (vars: V) => Promise<R>) {
  const invalidate = useInvalidateDemand();
  return useMutation({ mutationFn: fn, onSuccess: () => invalidate(demandId) });
}

export function useSaveJd(demandId: string) {
  return useJdMutation(demandId, (v: { kind: JdKind; content: string }) => demandsApi.saveJd(demandId, v.kind, v.content));
}

export function useGenerateJd(demandId: string) {
  return useJdMutation(demandId, (kind: JdKind) => demandsApi.generateJd(demandId, kind));
}

export function useRestoreJd(demandId: string) {
  return useJdMutation(demandId, (versionId: string) => demandsApi.restoreJd(demandId, versionId));
}

export function useBiasCheck(demandId: string) {
  return useMutation({ mutationFn: (versionId: string) => demandsApi.biasCheck(demandId, versionId) });
}

export function usePublish(demandId: string) {
  return useJdMutation(demandId, (body: PostingIn) => demandsApi.publish(demandId, body));
}

export function useUnpublish(demandId: string) {
  return useJdMutation(demandId, () => demandsApi.unpublish(demandId));
}
