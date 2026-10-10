"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { assessmentsApi, type InvitationFilters, type ItemFilters } from "./api";
import type { AssessmentBadge } from "./types";

export const assessmentKeys = {
  all: ["assessments"] as const,
  list: (status: string | undefined) => ["assessments", "list", status ?? "all"] as const,
  detail: (id: string) => ["assessments", "detail", id] as const,
  items: (f: ItemFilters) => ["assessments", "items", f] as const,
  item: (id: string) => ["assessments", "item", id] as const,
  itemVersions: (id: string) => ["assessments", "item", id, "versions"] as const,
  providerTests: (configId: string | null) => ["assessments", "provider-tests", configId ?? ""] as const,
  invitations: (f: InvitationFilters) => ["assessments", "invitations", f] as const,
  candidateResults: (candidateId: string) => ["assessments", "candidate-results", candidateId] as const,
  reviews: (status: string) => ["assessments", "reviews", status] as const,
  signals: (attemptId: string) => ["assessments", "signals", attemptId] as const,
  shares: (submissionId: string) => ["assessments", "shares", submissionId] as const,
  badge: (applicationId: string) => ["assessments", "badge", applicationId] as const,
};

export function useAssessmentPermissions() {
  return {
    canRead: usePermission("assessment:read"),
    canAuthor: usePermission("assessment:author"),
    canInvite: usePermission("assessment:invite"),
    canReview: usePermission("assessment:review"),
  };
}

export function useAssessments(status?: string, enabled = true) {
  return useQuery({ queryKey: assessmentKeys.list(status), queryFn: ({ signal }) => assessmentsApi.list(status, signal), enabled });
}

/** Published assessments, for pickers. */
export function usePublishedAssessments(enabled = true) {
  return useAssessments("published", enabled);
}

export function useAssessment(id: string, enabled = true) {
  return useQuery({ queryKey: assessmentKeys.detail(id), queryFn: ({ signal }) => assessmentsApi.get(id, signal), enabled });
}

export function useItems(f: ItemFilters, enabled = true) {
  return useQuery({ queryKey: assessmentKeys.items(f), queryFn: ({ signal }) => assessmentsApi.items(f, signal), enabled, placeholderData: (p) => p });
}

export function useItemVersions(id: string | null) {
  return useQuery({ queryKey: assessmentKeys.itemVersions(id ?? ""), queryFn: ({ signal }) => assessmentsApi.itemVersions(id ?? "", signal), enabled: Boolean(id) });
}

export function useProviderTests(configId: string | null, enabled = true) {
  return useQuery({
    queryKey: assessmentKeys.providerTests(configId),
    queryFn: ({ signal }) => assessmentsApi.providerTests(configId, signal),
    enabled,
    retry: false,
  });
}

export function useInvitations(f: InvitationFilters, enabled = true) {
  return useQuery({ queryKey: assessmentKeys.invitations(f), queryFn: ({ signal }) => assessmentsApi.invitations(f, signal), enabled });
}

export function useCandidateResults(candidateId: string, enabled = true) {
  return useQuery({
    queryKey: assessmentKeys.candidateResults(candidateId),
    queryFn: ({ signal }) => assessmentsApi.candidateResults(candidateId, signal),
    enabled,
  });
}

export function useReviews(status = "pending", enabled = true) {
  return useQuery({ queryKey: assessmentKeys.reviews(status), queryFn: ({ signal }) => assessmentsApi.reviews(status, signal), enabled });
}

export function useSignals(attemptId: string | null) {
  return useQuery({
    queryKey: assessmentKeys.signals(attemptId ?? ""),
    queryFn: ({ signal }) => assessmentsApi.signals(attemptId ?? "", signal),
    enabled: Boolean(attemptId),
  });
}

/** Invalidate everything under the assessments key (lists, results, badges). */
export function useRefreshAssessments() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: assessmentKeys.all });
}

// ---------------------------------------------------------------- pipeline badges: one batched request per board render

const BATCH_MAX = 200;
type Waiter = { resolve: (b: AssessmentBadge | null) => void; reject: (e: unknown) => void };
let queued = new Map<string, Waiter[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  const batch = queued;
  queued = new Map();
  const ids = [...batch.keys()];
  for (let i = 0; i < ids.length; i += BATCH_MAX) {
    const chunk = ids.slice(i, i + BATCH_MAX);
    assessmentsApi
      .badges(chunk)
      .then((out) => {
        const byApp = new Map(out.items.map((b) => [b.application_id, b]));
        for (const id of chunk) for (const w of batch.get(id) ?? []) w.resolve(byApp.get(id) ?? null);
      })
      .catch((e) => {
        for (const id of chunk) for (const w of batch.get(id) ?? []) w.reject(e);
      });
  }
}

/** Collects every card's id in the same tick into one `GET /applications/assessment-badges?ids=...` call. */
function loadBadge(applicationId: string): Promise<AssessmentBadge | null> {
  return new Promise((resolve, reject) => {
    const list = queued.get(applicationId) ?? [];
    list.push({ resolve, reject });
    queued.set(applicationId, list);
    if (!timer) timer = setTimeout(flush, 0);
  });
}

export function useAssessmentBadge(applicationId: string) {
  const canRead = usePermission("assessment:read");
  return useQuery({
    queryKey: assessmentKeys.badge(applicationId),
    queryFn: () => loadBadge(applicationId),
    enabled: canRead,
    staleTime: 60_000,
    retry: false,
  });
}
