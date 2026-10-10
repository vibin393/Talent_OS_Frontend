"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_PAGE_SIZE } from "@/features/admin/query";
import { usePermission } from "@/features/auth/use-permission";
import type { DemandCreate } from "@/lib/api/types";
import { demandKeys, demandsApi } from "./api";
import type { DemandListFilters } from "./query";

/** Paged demand list for `filters` (keeps the previous page while the next one loads). */
export function useDemands(filters: DemandListFilters, pageSize = DEFAULT_PAGE_SIZE) {
  const canRead = usePermission("demand:read");
  return useQuery({
    queryKey: demandKeys.list(filters, pageSize),
    queryFn: ({ signal }) => demandsApi.list(filters, pageSize, signal),
    enabled: canRead,
    placeholderData: (prev) => prev,
  });
}

export function useCreateDemand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DemandCreate) => demandsApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: demandKeys.lists }),
  });
}

/** AI intake from pasted text or one PDF/DOCX file; creates a Draft. */
export function useIntake() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { clientId: string; text?: string; file?: File }) => {
      const form = new FormData();
      form.set("client_id", input.clientId);
      if (input.file) form.set("file", input.file);
      else form.set("text", input.text ?? "");
      return demandsApi.intake(form);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: demandKeys.lists }),
  });
}
