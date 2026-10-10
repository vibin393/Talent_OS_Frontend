"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { immigrationApi, workImmigrationApi } from "./api";
import type { CaseFilters } from "./logic";

export const immigrationKeys = {
  all: ["immigration"] as const,
  templates: ["immigration", "templates"] as const,
  visaTypes: (includeArchived: boolean) => ["immigration", "visa-types", includeArchived] as const,
  visaType: (id: string) => ["immigration", "visa-type", id] as const,
  counsel: (includeArchived: boolean) => ["immigration", "counsel", includeArchived] as const,
  cases: (filters: CaseFilters) => ["immigration", "cases", filters] as const,
  case: (id: string) => ["immigration", "case", id] as const,
  caseSub: (id: string, sub: "timeline" | "dependants" | "requests" | "permits") => ["immigration", "case", id, sub] as const,
  dashboard: ["immigration", "dashboard"] as const,
  atRisk: ["immigration", "dashboard", "at-risk"] as const,
};

export const workImmigrationKeys = {
  list: ["portal", "work", "immigration"] as const,
  case: (id: string) => ["portal", "work", "immigration", id] as const,
};

/** Permission flags used across the Immigration screens. */
export function useImmigrationPermissions() {
  return {
    canRead: usePermission("immigration:read"),
    canManage: usePermission("immigration:manage"),
    canConfigure: usePermission("immigration:configure"),
    canUnmask: usePermission("identity:view"),
  };
}

export function useImmigrationCases(filters: CaseFilters, enabled = true) {
  return useQuery({ queryKey: immigrationKeys.cases(filters), queryFn: ({ signal }) => immigrationApi.cases(filters, signal), enabled });
}

export function useImmigrationCase(id: string, enabled = true) {
  return useQuery({ queryKey: immigrationKeys.case(id), queryFn: ({ signal }) => immigrationApi.case(id, signal), enabled });
}

export function useCaseTimeline(id: string, enabled = true) {
  return useQuery({ queryKey: immigrationKeys.caseSub(id, "timeline"), queryFn: ({ signal }) => immigrationApi.timeline(id, signal), enabled });
}

export function useCaseDependants(id: string, enabled = true) {
  return useQuery({ queryKey: immigrationKeys.caseSub(id, "dependants"), queryFn: ({ signal }) => immigrationApi.dependants(id, signal), enabled });
}

export function useCaseRequests(id: string, enabled = true) {
  return useQuery({ queryKey: immigrationKeys.caseSub(id, "requests"), queryFn: ({ signal }) => immigrationApi.requests(id, signal), enabled });
}

export function useCasePermits(id: string, enabled = true) {
  return useQuery({ queryKey: immigrationKeys.caseSub(id, "permits"), queryFn: ({ signal }) => immigrationApi.permits(id, signal), enabled });
}

export function useVisaTypes(includeArchived = false, enabled = true) {
  return useQuery({
    queryKey: immigrationKeys.visaTypes(includeArchived),
    queryFn: ({ signal }) => immigrationApi.visaTypes(includeArchived, signal),
    enabled,
  });
}

export function useVisaType(id: string | null) {
  return useQuery({
    queryKey: immigrationKeys.visaType(id ?? ""),
    queryFn: ({ signal }) => immigrationApi.visaType(id ?? "", signal),
    enabled: Boolean(id),
  });
}

export function useVisaTemplates(enabled = true) {
  return useQuery({ queryKey: immigrationKeys.templates, queryFn: ({ signal }) => immigrationApi.templates(signal), enabled });
}

export function useCounsel(includeArchived = false, enabled = true) {
  return useQuery({
    queryKey: immigrationKeys.counsel(includeArchived),
    queryFn: ({ signal }) => immigrationApi.counsel(includeArchived, signal),
    enabled,
  });
}

export function useImmigrationDashboard(enabled = true) {
  return useQuery({ queryKey: immigrationKeys.dashboard, queryFn: ({ signal }) => immigrationApi.dashboard(signal), enabled });
}

export function useAtRisk(enabled = true) {
  return useQuery({ queryKey: immigrationKeys.atRisk, queryFn: ({ signal }) => immigrationApi.atRisk(signal), enabled });
}

/** Invalidates a case and everything hanging off it (sub-resources, lists, dashboard). */
export function useRefreshCase(id: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: immigrationKeys.case(id) });
    void qc.invalidateQueries({ queryKey: ["immigration", "cases"] });
    void qc.invalidateQueries({ queryKey: immigrationKeys.dashboard });
  };
}

export function useWorkImmigration() {
  return useQuery({ queryKey: workImmigrationKeys.list, queryFn: ({ signal }) => workImmigrationApi.cases(signal), retry: false });
}

export function useWorkImmigrationCase(id: string) {
  return useQuery({ queryKey: workImmigrationKeys.case(id), queryFn: ({ signal }) => workImmigrationApi.case(id, signal), retry: false });
}
