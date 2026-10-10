"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { type EmployeeMobilityApi, mobilityApi } from "./api";
import { MOBILITY_MANAGE, MOBILITY_TRANSFER } from "./logic";
import type { OpeningFilters, SubjectKind } from "./types";

export const mobilityKeys = {
  all: ["mobility"] as const,
  settings: ["mobility", "settings"] as const,
  demandApplications: (demandId: string) => ["mobility", "applications", "demand", demandId] as const,
  byApplication: (applicationId: string) => ["mobility", "applications", "by-application", applicationId] as const,
  transferContext: (id: string) => ["mobility", "transfer-context", id] as const,
  rules: (demandId: string) => ["mobility", "rules", demandId] as const,
  profiles: (kind: SubjectKind) => ["mobility", "profiles", kind] as const,
};

/** Query keys for an Employee surface (`me` = internal User, `work` = Worker portal). */
export function employeeKeys(scope: "me" | "work") {
  const root = scope === "me" ? (["me", "mobility"] as const) : (["portal", "work", "opportunities"] as const);
  return {
    root,
    openings: (f: OpeningFilters) => [...root, "openings", f] as const,
    opening: (demandId: string) => [...root, "opening", demandId] as const,
    applications: [...root, "applications"] as const,
    profile: [...root, "profile"] as const,
  };
}

export function useMobilityPermissions() {
  return { canManage: usePermission(MOBILITY_MANAGE), canTransfer: usePermission(MOBILITY_TRANSFER) };
}

export function useOpenings(client: EmployeeMobilityApi, filters: OpeningFilters) {
  return useQuery({
    queryKey: employeeKeys(client.scope).openings(filters),
    queryFn: ({ signal }) => client.openings(filters, signal),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useOpening(client: EmployeeMobilityApi, demandId: string) {
  return useQuery({
    queryKey: employeeKeys(client.scope).opening(demandId),
    queryFn: ({ signal }) => client.opening(demandId, signal),
    retry: false,
  });
}

export function useMyApplications(client: EmployeeMobilityApi) {
  return useQuery({
    queryKey: employeeKeys(client.scope).applications,
    queryFn: ({ signal }) => client.applications(signal),
    retry: false,
  });
}

export function useProfilePreview(client: EmployeeMobilityApi, enabled: boolean) {
  return useQuery({
    queryKey: employeeKeys(client.scope).profile,
    queryFn: ({ signal }) => (client.profile ? client.profile(signal) : Promise.reject(new Error("unsupported"))),
    enabled: enabled && Boolean(client.profile),
    retry: false,
  });
}

/** Recruiter view of a Demand's internal applications (also the "Internal" badge map for the pipeline board). */
export function useDemandInternalApplications(demandId: string, enabled = true) {
  const canManage = usePermission(MOBILITY_MANAGE);
  const canReadDemand = usePermission("demand:read");
  return useQuery({
    queryKey: mobilityKeys.demandApplications(demandId),
    queryFn: ({ signal }) => mobilityApi.applications(demandId, signal),
    enabled: enabled && Boolean(demandId) && (canManage || canReadDemand),
    staleTime: 60_000,
    retry: false,
  });
}

/** The internal overlay of one Application (`null` when the Application is not internal). */
export function useInternalApplication(applicationId: string, enabled = true) {
  return useQuery({
    queryKey: mobilityKeys.byApplication(applicationId),
    queryFn: async ({ signal }) => {
      try {
        return await mobilityApi.byApplication(applicationId, signal);
      } catch (e) {
        if (e && typeof e === "object" && "status" in e && (e as { status: number }).status === 404) return null;
        throw e;
      }
    },
    enabled: enabled && Boolean(applicationId),
    staleTime: 60_000,
    retry: false,
  });
}

export function useTransferContext(id: string | null) {
  return useQuery({
    queryKey: mobilityKeys.transferContext(id ?? ""),
    queryFn: ({ signal }) => mobilityApi.transferContext(id ?? "", signal),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useOpeningRules(demandId: string, enabled: boolean) {
  return useQuery({
    queryKey: mobilityKeys.rules(demandId),
    queryFn: ({ signal }) => mobilityApi.rules(demandId, signal),
    enabled,
    retry: false,
  });
}

export function useMobilitySettings(enabled: boolean) {
  return useQuery({ queryKey: mobilityKeys.settings, queryFn: ({ signal }) => mobilityApi.settings(signal), enabled });
}

export function useProfiles(kind: SubjectKind, enabled: boolean) {
  return useQuery({ queryKey: mobilityKeys.profiles(kind), queryFn: ({ signal }) => mobilityApi.profiles(kind, signal), enabled });
}
