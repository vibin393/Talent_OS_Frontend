"use client";

import { useQuery } from "@tanstack/react-query";
import { usePermission } from "@/features/auth/use-permission";
import { api } from "@/lib/api/client";
import type { CandidateOut, ClientOut, DemandOut, Page } from "@/lib/api/types";

const enc = encodeURIComponent;

/** Entity types that can be searched by name / ID for linking. */
export type SearchableEntity = "candidate" | "demand" | "client";

export type EntityHit = { id: string; label: string; secondary?: string };

const READ_PERMISSION: Record<SearchableEntity, string> = {
  candidate: "candidate:read",
  demand: "demand:read",
  client: "client:read",
};

async function search(type: SearchableEntity, q: string, signal?: AbortSignal): Promise<EntityHit[]> {
  const qs = `q=${enc(q)}&page=1&page_size=10`;
  if (type === "candidate") {
    const page = await api.get<Page<CandidateOut>>(`/api/v1/candidates?${qs}`, { signal });
    return page.items.map((c) => ({ id: c.id, label: `${c.human_id} ${c.full_name}`, secondary: c.primary_email ?? undefined }));
  }
  if (type === "demand") {
    const page = await api.get<Page<DemandOut>>(`/api/v1/demands?${qs}`, { signal });
    return page.items.map((d) => ({ id: d.id, label: `${d.req_id} ${d.title}`, secondary: d.client_name ?? undefined }));
  }
  const page = await api.get<Page<ClientOut>>(`/api/v1/clients?${qs}`, { signal });
  return page.items.map((c) => ({ id: c.id, label: c.name, secondary: c.industry ?? undefined }));
}

export function useEntitySearch(type: SearchableEntity | null, q: string, enabled: boolean) {
  const candidate = usePermission("candidate:read");
  const demand = usePermission("demand:read");
  const client = usePermission("client:read");
  const allowed = { candidate, demand, client };
  return useQuery({
    queryKey: ["entity-search", type, q.trim()],
    queryFn: ({ signal }) => search(type as SearchableEntity, q.trim(), signal),
    enabled: enabled && !!type && allowed[type],
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });
}

export function canSearch(type: SearchableEntity, permissions: Record<string, string>): boolean {
  return READ_PERMISSION[type] in permissions;
}

/**
 * Short label for a linked entity chip (`CAN-…`, `REQ-…`, client name), resolved lazily and cached.
 * Contacts and applications have no cheap lookup and show their type only.
 */
export function useEntityLabel(type: string | null | undefined, id: string | null | undefined) {
  const candidate = usePermission("candidate:read");
  const demand = usePermission("demand:read");
  const client = usePermission("client:read");
  const ok = (type === "candidate" && candidate) || (type === "demand" && demand) || (type === "client" && client);
  return useQuery({
    queryKey: ["entity-label", type, id],
    queryFn: async ({ signal }) => {
      if (type === "candidate") {
        const c = await api.get<CandidateOut>(`/api/v1/candidates/${enc(id ?? "")}`, { signal });
        return { short: c.human_id, full: `${c.human_id} ${c.full_name}` };
      }
      if (type === "demand") {
        const d = await api.get<DemandOut>(`/api/v1/demands/${enc(id ?? "")}`, { signal });
        return { short: d.req_id, full: `${d.req_id} ${d.title}` };
      }
      const c = await api.get<ClientOut>(`/api/v1/clients/${enc(id ?? "")}`, { signal });
      return { short: c.name, full: c.name };
    },
    enabled: !!id && ok,
    staleTime: 10 * 60_000,
    retry: false,
  });
}
