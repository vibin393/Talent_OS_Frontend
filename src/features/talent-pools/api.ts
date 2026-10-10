import { api } from "@/lib/api/client";
import type {
  AddMembersOut,
  MemberPage,
  PipelineAddOut,
  PoolCreate,
  PoolListParams,
  PoolOut,
  PoolPin,
  PoolTemplate,
  PoolUpdate,
  RediscoveryOut,
  RefreshOut,
} from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";
const P = `${V}/talent-pools`;

function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const poolsApi = {
  list: (params: PoolListParams, signal?: AbortSignal) =>
    api.get<PoolOut[]>(`${P}${query({ ...params, include_archived: params.include_archived ? true : undefined })}`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<PoolOut>(`${P}/${enc(id)}`, { signal }),
  create: (body: PoolCreate) => api.post<PoolOut>(P, body),
  update: (id: string, body: PoolUpdate) => api.patch<PoolOut>(`${P}/${enc(id)}`, body),
  archive: (id: string) => api.delete<PoolOut>(`${P}/${enc(id)}`),

  members: (id: string, page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<MemberPage>(`${P}/${enc(id)}/members${query({ page, page_size: pageSize })}`, { signal }),
  addMembers: (id: string, candidate_ids: string[]) => api.post<AddMembersOut>(`${P}/${enc(id)}/members`, { candidate_ids }),
  removeMember: (id: string, candidateId: string) => api.delete<void>(`${P}/${enc(id)}/members/${enc(candidateId)}`),

  refresh: (id: string) => api.post<RefreshOut>(`${P}/${enc(id)}/refresh`),
  refreshes: (id: string, signal?: AbortSignal) => api.get<RefreshOut[]>(`${P}/${enc(id)}/refreshes`, { signal }),

  subscribe: (id: string) => api.post<{ subscribed: boolean }>(`${P}/${enc(id)}/subscription`),
  unsubscribe: (id: string) => api.delete<{ subscribed: boolean }>(`${P}/${enc(id)}/subscription`),

  templates: (signal?: AbortSignal) => api.get<PoolTemplate[]>(`${P}/templates`, { signal }),
  enableTemplate: (key: string, batch?: string | null) =>
    api.post<PoolOut>(`${P}/templates/${enc(key)}/enable`, batch ? { batch } : {}),

  // Demand integration
  rediscovery: (demandId: string, signal?: AbortSignal) => api.get<RediscoveryOut>(`${V}/demands/${enc(demandId)}/rediscovery`, { signal }),
  pins: (demandId: string, signal?: AbortSignal) => api.get<PoolPin[]>(`${V}/demands/${enc(demandId)}/pool-pins`, { signal }),
  pin: (demandId: string, poolId: string) => api.post<PoolPin>(`${V}/demands/${enc(demandId)}/pool-pins`, { pool_id: poolId }),
  unpin: (demandId: string, poolId: string) => api.delete<void>(`${V}/demands/${enc(demandId)}/pool-pins/${enc(poolId)}`),
  addToPipeline: (demandId: string, poolId: string, body: { candidate_ids?: string[]; top_n?: number }) =>
    api.post<PipelineAddOut>(`${V}/demands/${enc(demandId)}/pools/${enc(poolId)}/add-to-pipeline`, body),
};

export const poolKeys = {
  all: ["talent-pools"] as const,
  list: (params: PoolListParams) => ["talent-pools", "list", params] as const,
  detail: (id: string) => ["talent-pools", "detail", id] as const,
  members: (id: string, page: number) => ["talent-pools", "members", id, page] as const,
  refreshes: (id: string) => ["talent-pools", "refreshes", id] as const,
  templates: ["talent-pools", "templates"] as const,
  rediscovery: (demandId: string) => ["talent-pools", "rediscovery", demandId] as const,
  pins: (demandId: string) => ["talent-pools", "pins", demandId] as const,
};
