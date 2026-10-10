"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { isApiError } from "@/lib/api/errors";
import { fairnessApi, portalFairnessApi, publicFairnessApi } from "./api";
import { isRunActive, PERM_AEDT, PERM_CONFIGURE, PERM_READ } from "./logic";
import type { AedtIn, CategorySetIn, FairnessSettingsPatch, PublicationCreate, RunCreate, SelfIdIn } from "./types";

export const fairnessKeys = {
  all: ["fairness"] as const,
  settings: ["fairness", "settings"] as const,
  runs: ["fairness", "runs"] as const,
  run: (id: string) => ["fairness", "runs", id] as const,
  aedts: ["fairness", "aedt"] as const,
  publications: ["fairness", "publications"] as const,
  ll144: (demandId: string) => ["fairness", "ll144", demandId] as const,
  altRequest: (applicationId: string) => ["fairness", "alt-request", applicationId] as const,
  portalSelfId: ["portal", "fairness", "self-id"] as const,
  portalAltRequests: ["portal", "fairness", "alternative-requests"] as const,
  publicSelfIdForm: (slug: string) => ["public", "fairness", slug, "self-id-form"] as const,
  publicNotice: (slug: string, postingId: string) => ["public", "fairness", slug, "notice", postingId] as const,
  publicSummary: (slug: string) => ["public", "fairness", slug, "summary"] as const,
};

const POLL_MS = 3000;

/** 403 / 404 mean "hide": do not retry them. */
export function retryUnlessDenied(count: number, error: unknown): boolean {
  if (isApiError(error) && (error.status === 403 || error.status === 404 || error.status === 410)) return false;
  return count < 2;
}

export function useFairnessPermissions() {
  return {
    canRead: usePermission(PERM_READ),
    canConfigure: usePermission(PERM_CONFIGURE),
    canManageAedt: usePermission(PERM_AEDT),
  };
}

// ---------------------------------------------------------------- settings

export function useFairnessSettings(enabled = true) {
  return useQuery({ queryKey: fairnessKeys.settings, queryFn: ({ signal }) => fairnessApi.settings(signal), enabled, retry: retryUnlessDenied });
}

export function useSaveFairnessSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FairnessSettingsPatch) => fairnessApi.saveSettings(body),
    onSuccess: (data) => qc.setQueryData(fairnessKeys.settings, data),
  });
}

export function useSaveCategorySet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CategorySetIn) => fairnessApi.saveCategorySet(body),
    onSuccess: (data) => qc.setQueryData(fairnessKeys.settings, data),
  });
}

// ---------------------------------------------------------------- runs

/** Epic 65: selection points with availability (agent points are hidden when `available=false`). */
export function useSelectionPoints(enabled = true) {
  return useQuery({
    queryKey: ["fairness", "selection-points"] as const,
    queryFn: ({ signal }) => fairnessApi.selectionPoints(signal),
    enabled,
    retry: retryUnlessDenied,
    staleTime: 5 * 60_000,
  });
}

export function useRuns(enabled = true) {
  return useQuery({
    queryKey: fairnessKeys.runs,
    queryFn: ({ signal }) => fairnessApi.runs(signal),
    enabled,
    retry: retryUnlessDenied,
    // Poll while any run is queued / running.
    refetchInterval: (q) => (q.state.data?.some((r) => isRunActive(r.status)) ? POLL_MS : false),
  });
}

export function useRun(id: string, enabled = true) {
  return useQuery({
    queryKey: fairnessKeys.run(id),
    queryFn: ({ signal }) => fairnessApi.run(id, signal),
    enabled: enabled && !!id,
    retry: retryUnlessDenied,
    refetchInterval: (q) => (isRunActive(q.state.data?.status) ? POLL_MS : false),
  });
}

export function useCreateRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RunCreate) => fairnessApi.createRun(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: fairnessKeys.runs }),
  });
}

export function useGeneratePack(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (aedtId: string) => fairnessApi.generatePack(runId, aedtId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: fairnessKeys.run(runId) }),
  });
}

// ---------------------------------------------------------------- AEDT / publications

export function useAedts(enabled = true) {
  return useQuery({ queryKey: fairnessKeys.aedts, queryFn: ({ signal }) => fairnessApi.aedts(signal), enabled, retry: retryUnlessDenied });
}

export function useSaveAedt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string | null; body: AedtIn }) => (id ? fairnessApi.updateAedt(id, body) : fairnessApi.createAedt(body)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: fairnessKeys.aedts }),
  });
}

export function usePublications(enabled = true) {
  return useQuery({
    queryKey: fairnessKeys.publications,
    queryFn: ({ signal }) => fairnessApi.publications(signal),
    enabled,
    retry: retryUnlessDenied,
  });
}

export function usePublish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PublicationCreate) => fairnessApi.publish(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: fairnessKeys.publications }),
  });
}

export function useUnpublish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fairnessApi.unpublish(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: fairnessKeys.publications }),
  });
}

// ---------------------------------------------------------------- LL144 / alternative requests

export function useLl144(demandId: string, enabled = true) {
  return useQuery({
    queryKey: fairnessKeys.ll144(demandId),
    queryFn: ({ signal }) => fairnessApi.ll144(demandId, signal),
    enabled: enabled && !!demandId,
    retry: retryUnlessDenied,
  });
}

export function useSetLl144(demandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (flagged: boolean) => fairnessApi.setLl144(demandId, flagged),
    onSuccess: (data) => qc.setQueryData(fairnessKeys.ll144(demandId), data),
  });
}

export function useAlternativeRequest(applicationId: string, enabled = true) {
  return useQuery({
    queryKey: fairnessKeys.altRequest(applicationId),
    queryFn: ({ signal }) => fairnessApi.alternativeRequest(applicationId, signal),
    enabled: enabled && !!applicationId,
    retry: retryUnlessDenied,
  });
}

// ---------------------------------------------------------------- Candidate Portal

export function usePortalSelfId() {
  return useQuery({ queryKey: fairnessKeys.portalSelfId, queryFn: ({ signal }) => portalFairnessApi.selfId(signal), retry: retryUnlessDenied });
}

export function useSavePortalSelfId() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SelfIdIn) => portalFairnessApi.saveSelfId(body),
    onSuccess: (data) => qc.setQueryData(fairnessKeys.portalSelfId, data),
  });
}

export function useDeletePortalSelfId() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => portalFairnessApi.deleteSelfId(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: fairnessKeys.portalSelfId }),
  });
}

export function usePortalAlternativeRequests(enabled = true) {
  return useQuery({
    queryKey: fairnessKeys.portalAltRequests,
    queryFn: ({ signal }) => portalFairnessApi.alternativeRequests(signal),
    enabled,
    retry: retryUnlessDenied,
  });
}

export function useRequestPortalAlternative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, note }: { applicationId: string; note: string | null }) => portalFairnessApi.requestAlternative(applicationId, note),
    onSuccess: () => void qc.invalidateQueries({ queryKey: fairnessKeys.portalAltRequests }),
  });
}

// ---------------------------------------------------------------- public

export function usePublicSelfIdForm(slug: string, enabled = true) {
  return useQuery({
    queryKey: fairnessKeys.publicSelfIdForm(slug),
    queryFn: ({ signal }) => publicFairnessApi.selfIdForm(slug, signal),
    enabled: enabled && !!slug,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function usePublicNotice(slug: string, postingId: string, enabled = true) {
  return useQuery({
    queryKey: fairnessKeys.publicNotice(slug, postingId),
    queryFn: ({ signal }) => publicFairnessApi.notice(slug, postingId, signal),
    enabled: enabled && !!slug && !!postingId,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function usePublicSummary(slug: string) {
  return useQuery({
    queryKey: fairnessKeys.publicSummary(slug),
    queryFn: ({ signal }) => publicFairnessApi.summary(slug, signal),
    enabled: !!slug,
    retry: false,
    staleTime: 5 * 60_000,
  });
}
