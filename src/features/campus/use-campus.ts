"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { campusApi, campusKeys } from "./api";
import type { DriveOut, DriveStatus, InstitutionFilters, RegistrationFilters } from "./types";

export function useCampusPermissions() {
  return {
    canRead: usePermission("campus:read"),
    canManage: usePermission("campus:manage"),
    canOverride: usePermission("campus_eligibility:override"),
    canInvite: usePermission("assessment:invite"),
    canOffer: usePermission("offer:create"),
    canPools: usePermission("pool:manage"),
  };
}

export function useInstitutions(f: InstitutionFilters, enabled = true) {
  return useQuery({
    queryKey: campusKeys.institutions(f),
    queryFn: ({ signal }) => campusApi.institutions(f, signal),
    placeholderData: (prev) => prev,
    enabled,
  });
}

export function useInstitution(id: string | null) {
  return useQuery({
    queryKey: campusKeys.institution(id ?? ""),
    queryFn: ({ signal }) => campusApi.institution(id ?? "", signal),
    enabled: Boolean(id),
  });
}

export function useDrives(f: { q?: string; status?: DriveStatus | "" }, enabled = true) {
  return useQuery({
    queryKey: campusKeys.drives(f),
    queryFn: ({ signal }) => campusApi.drives(f, signal),
    placeholderData: (prev) => prev,
    enabled,
  });
}

export function useDrive(id: string | null) {
  return useQuery({
    queryKey: campusKeys.drive(id ?? ""),
    queryFn: ({ signal }) => campusApi.drive(id ?? "", signal),
    enabled: Boolean(id),
  });
}

/** Mutation that returns the updated drive: writes it to the cache and refreshes the lists. */
export function useDriveMutation<V>(fn: (v: V) => Promise<DriveOut>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (drive) => {
      qc.setQueryData(campusKeys.drive(drive.id), drive);
      await qc.invalidateQueries({ queryKey: campusKeys.drivesRoot });
    },
  });
}

export function useRegistrations(driveId: string, f: RegistrationFilters, limit: number, offset: number, enabled = true) {
  return useQuery({
    queryKey: campusKeys.registrations(driveId, f, limit, offset),
    queryFn: ({ signal }) => campusApi.registrations(driveId, f, limit, offset, signal),
    placeholderData: (prev) => prev,
    enabled,
  });
}

export function useBatches(driveId: string) {
  return useQuery({ queryKey: campusKeys.batches(driveId), queryFn: ({ signal }) => campusApi.batches(driveId, signal) });
}

export function useJoining(driveId: string) {
  return useQuery({ queryKey: campusKeys.joining(driveId), queryFn: ({ signal }) => campusApi.joining(driveId, signal) });
}

export function useFunnel(driveId: string) {
  return useQuery({ queryKey: campusKeys.funnel(driveId), queryFn: ({ signal }) => campusApi.funnel(driveId, signal) });
}

/** Refresh everything that depends on a drive's registrations (lists, counts, funnel, joining). */
export function useInvalidateDrive(driveId: string) {
  const qc = useQueryClient();
  return async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: campusKeys.registrationsRoot(driveId) }),
      qc.invalidateQueries({ queryKey: campusKeys.drive(driveId) }),
      qc.invalidateQueries({ queryKey: campusKeys.funnel(driveId) }),
      qc.invalidateQueries({ queryKey: campusKeys.joining(driveId) }),
      qc.invalidateQueries({ queryKey: campusKeys.batches(driveId) }),
    ]);
  };
}
