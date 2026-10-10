import { api } from "@/lib/api/client";
import type {
  Definition,
  SegmentCreate,
  SegmentOut,
  SegmentPreview,
  SegmentUpdate,
  SegmentVersion,
  SemanticSource,
  BuilderSourceKey,
} from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";

export const segmentsApi = {
  source: (key: BuilderSourceKey, signal?: AbortSignal) => api.get<SemanticSource>(`${V}/semantic/sources/${enc(key)}`, { signal }),
  list: (signal?: AbortSignal) => api.get<SegmentOut[]>(`${V}/segments`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<SegmentOut>(`${V}/segments/${enc(id)}`, { signal }),
  create: (body: SegmentCreate) => api.post<SegmentOut>(`${V}/segments`, body),
  update: (id: string, body: SegmentUpdate) => api.patch<SegmentOut>(`${V}/segments/${enc(id)}`, body),
  archive: (id: string) => api.delete<void>(`${V}/segments/${enc(id)}`),
  versions: (id: string, signal?: AbortSignal) => api.get<SegmentVersion[]>(`${V}/segments/${enc(id)}/versions`, { signal }),
  preview: (source_key: BuilderSourceKey, definition: Definition, signal?: AbortSignal) =>
    api.post<SegmentPreview>(`${V}/segments/preview`, { source_key, definition }, { signal }),
};

export const segmentKeys = {
  all: ["segments"] as const,
  source: (key: BuilderSourceKey) => ["semantic", "source", key] as const,
  detail: (id: string) => ["segments", "detail", id] as const,
  versions: (id: string) => ["segments", "versions", id] as const,
  preview: (key: BuilderSourceKey, json: string) => ["segments", "preview", key, json] as const,
};
