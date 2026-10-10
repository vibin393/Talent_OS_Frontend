"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type { AssignmentsIn } from "@/lib/api/types";
import { demandKeys, demandsApi } from "./api";
import { useInvalidateDemand } from "./use-demand";

export function useAssignments(demandId: string) {
  return useQuery({
    queryKey: demandKeys.assignments(demandId),
    queryFn: ({ signal }) => demandsApi.assignments(demandId, signal),
  });
}

export function useSetAssignments(demandId: string) {
  const invalidate = useInvalidateDemand();
  return useMutation({
    mutationFn: (body: AssignmentsIn) => demandsApi.setAssignments(demandId, body),
    onSuccess: () => invalidate(demandId),
  });
}
