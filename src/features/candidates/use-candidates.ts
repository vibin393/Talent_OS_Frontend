"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppToast } from "@/components/toast";
import { candidateKeys, candidatesApi } from "./api";
import { candidateErrorMessage } from "./errors";

/**
 * A mutation that invalidates the given query keys on success and shows a success toast.
 * Errors are left to the caller, or toasted when `toastErrors`.
 */
export function useCandidateMutation<TVars, TResult>({
  mutationFn,
  invalidate = [],
  success,
  toastErrors = false,
}: {
  mutationFn: (vars: TVars) => Promise<TResult>;
  invalidate?: readonly (readonly unknown[])[];
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
      if (toastErrors) toast.error(candidateErrorMessage(error));
    },
  });
}

/** One page (max size) of saved lists the user can see, for pickers and filters. */
export function useSavedListLookup(enabled = true) {
  return useQuery({
    queryKey: candidateKeys.savedListPage(1, 100),
    queryFn: ({ signal }) => candidatesApi.listLists(1, 100, false, signal),
    enabled,
  });
}

/** Number of open duplicate pairs (toolbar badge). */
export function useOpenDuplicateCount(enabled = true) {
  return useQuery({
    queryKey: candidateKeys.duplicateList("open", 0),
    queryFn: ({ signal }) => candidatesApi.listDuplicates("open", 1, 1, signal),
    enabled,
    select: (page) => page.total,
    staleTime: 30_000,
  });
}
