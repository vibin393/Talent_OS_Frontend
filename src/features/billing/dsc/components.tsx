"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { clientKeys, clientsApi } from "@/features/clients/api";
import { legalEntitiesApi, legalEntityKeys } from "@/features/legal-entities/api";
import type { GstRegistrationOut } from "@/features/legal-entities/types";

/** A client's name by id (falls back to a short id while loading or when unreadable). */
export function ClientName({ id }: { id: string }) {
  const q = useQuery({ queryKey: clientKeys.detail(id), queryFn: ({ signal }) => clientsApi.get(id, signal), staleTime: 60_000, retry: false });
  return <>{q.data?.name ?? `${id.slice(0, 8)}…`}</>;
}

export type RegistrationOption = GstRegistrationOut & { legal_entity_name: string };

/** Every GST registration across the tenant's Legal Entities (for the policy pickers and labels). */
export function useAllRegistrations(enabled = true): { data: RegistrationOption[]; loading: boolean } {
  const les = useQuery({ queryKey: legalEntityKeys.list, queryFn: ({ signal }) => legalEntitiesApi.list(signal), enabled });
  const regs = useQueries({
    queries: (les.data ?? []).map((le) => ({
      queryKey: legalEntityKeys.registrations(le.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => legalEntitiesApi.registrations(le.id, signal),
      enabled,
    })),
  });
  const data: RegistrationOption[] = [];
  (les.data ?? []).forEach((le, i) => {
    for (const r of regs[i]?.data ?? []) data.push({ ...r, legal_entity_name: le.name });
  });
  return { data, loading: les.isLoading || regs.some((r) => r.isLoading) };
}
