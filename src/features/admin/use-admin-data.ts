"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppToast } from "@/components/toast";
import { adminApi, adminKeys, LOOKUP_PAGE_SIZE } from "./api";
import { adminErrorMessage } from "./errors";

/** Roles (unpaginated). Needs `role:read`. */
export function useRoles(enabled = true) {
  return useQuery({ queryKey: adminKeys.roles, queryFn: ({ signal }) => adminApi.listRoles(signal), enabled });
}

/** Permission catalog for the role editor. Needs `role:read`. */
export function usePermissionCatalog(enabled = true) {
  return useQuery({
    queryKey: adminKeys.permissions,
    queryFn: ({ signal }) => adminApi.permissions(signal),
    staleTime: 10 * 60_000,
    enabled,
  });
}

/** First page (max size) of teams for pickers. Needs `team:read`. */
export function useTeamLookup(enabled = true) {
  return useQuery({
    queryKey: adminKeys.teamList(1, LOOKUP_PAGE_SIZE),
    queryFn: ({ signal }) => adminApi.listTeams(1, LOOKUP_PAGE_SIZE, signal),
    enabled,
  });
}

/** First page (max size) of business units for pickers. Needs `business_unit:read`. */
export function useBusinessUnitLookup(enabled = true) {
  return useQuery({
    queryKey: adminKeys.businessUnitList(1, LOOKUP_PAGE_SIZE),
    queryFn: ({ signal }) => adminApi.listBusinessUnits(1, LOOKUP_PAGE_SIZE, signal),
    enabled,
  });
}

/**
 * A mutation that invalidates the given admin query keys on success and shows a success toast.
 * Errors are left to the caller (inline `MessageBar` / field errors), or toasted when `toastErrors`.
 */
export function useAdminMutation<TVars, TResult>({
  mutationFn,
  invalidate,
  success,
  toastErrors = false,
}: {
  mutationFn: (vars: TVars) => Promise<TResult>;
  invalidate: readonly (readonly unknown[])[];
  success?: string | ((result: TResult, vars: TVars) => string);
  toastErrors?: boolean;
}) {
  const queryClient = useQueryClient();
  const toast = useAppToast();
  return useMutation({
    mutationFn,
    onSuccess: async (result, vars) => {
      if (success) toast.success(typeof success === "function" ? success(result, vars) : success);
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
    onError: (error) => {
      if (toastErrors) toast.error(adminErrorMessage(error));
    },
  });
}
