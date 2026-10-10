"use client";

import { useQuery } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { type ReferrerApi, referralsApi } from "./api";
import type { ReferralFilters } from "./logic";
import type { RewardStatus } from "./types";

export const referralKeys = {
  all: ["referrals"] as const,
  list: (filters: ReferralFilters, limit: number, offset: number) => ["referrals", "list", filters, limit, offset] as const,
  detail: (id: string) => ["referrals", "detail", id] as const,
  byCandidate: (candidateId: string) => ["referrals", "by-candidate", candidateId] as const,
  rewards: (status: RewardStatus | null) => ["referrals", "rewards", status] as const,
  programs: (includeArchived: boolean) => ["referrals", "programs", includeArchived] as const,
  settings: ["referrals", "settings"] as const,
};

/** Query keys for a referrer surface (`me` = internal User, `work` = Worker portal). */
export function referrerKeys(scope: "me" | "work") {
  const root = scope === "me" ? (["me", "referrals"] as const) : (["portal", "work", "referrals"] as const);
  return { root, list: [...root, "list"] as const, openings: [...root, "openings"] as const };
}

export function useReferralPermissions() {
  return {
    canRead: usePermission("referral:read"),
    canManage: usePermission("referral:manage"),
    canConfigure: usePermission("referral:configure"),
  };
}

export function useMyReferrals(scope: "me" | "work", client: ReferrerApi) {
  const keys = referrerKeys(scope);
  return useQuery({ queryKey: keys.list, queryFn: ({ signal }) => client.list(signal), retry: false });
}

export function useReferralOpenings(scope: "me" | "work", client: ReferrerApi) {
  const keys = referrerKeys(scope);
  return useQuery({ queryKey: keys.openings, queryFn: ({ signal }) => client.openings(signal), retry: false });
}

export function useReferrals(filters: ReferralFilters, limit: number, offset: number, enabled = true) {
  return useQuery({
    queryKey: referralKeys.list(filters, limit, offset),
    queryFn: ({ signal }) => referralsApi.list(filters, limit, offset, signal),
    placeholderData: (prev) => prev,
    enabled,
  });
}

export function useReferral(id: string | null) {
  return useQuery({
    queryKey: referralKeys.detail(id ?? ""),
    queryFn: ({ signal }) => referralsApi.get(id ?? "", signal),
    enabled: Boolean(id),
  });
}

export function useCandidateReferrals(candidateId: string, enabled = true) {
  return useQuery({
    queryKey: referralKeys.byCandidate(candidateId),
    queryFn: ({ signal }) => referralsApi.byCandidate(candidateId, signal),
    enabled,
    staleTime: 60_000,
  });
}

export function useRewards(status: RewardStatus | null, enabled = true) {
  return useQuery({ queryKey: referralKeys.rewards(status), queryFn: ({ signal }) => referralsApi.rewards(status, signal), enabled });
}

export function usePrograms(includeArchived = false, enabled = true) {
  return useQuery({
    queryKey: referralKeys.programs(includeArchived),
    queryFn: ({ signal }) => referralsApi.programs(includeArchived, signal),
    enabled,
  });
}

export function useReferralSettings(enabled = true) {
  return useQuery({ queryKey: referralKeys.settings, queryFn: ({ signal }) => referralsApi.settings(signal), enabled });
}
