import { api } from "@/lib/api/client";
import type { Channel } from "@/features/campaigns/types";
import type {
  AudienceCreate,
  AudienceOut,
  AudiencePreviewOut,
  AudienceUpdate,
  ListImportOut,
  SourceMode,
} from "./types";

const enc = encodeURIComponent;
const A = "/api/v1/marketing/audiences";

export const audiencesApi = {
  list: (signal?: AbortSignal) => api.get<AudienceOut[]>(A, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<AudienceOut>(`${A}/${enc(id)}`, { signal }),
  create: (body: AudienceCreate) => api.post<AudienceOut>(A, body),
  update: (id: string, body: AudienceUpdate) => api.patch<AudienceOut>(`${A}/${enc(id)}`, body),
  archive: (id: string) => api.delete<void>(`${A}/${enc(id)}`),
  preview: (id: string, channel?: Channel | null) =>
    api.post<AudiencePreviewOut>(`${A}/${enc(id)}/preview${channel ? `?channel=${enc(channel)}` : ""}`),
  listImport: (id: string, file: File, mode: SourceMode, apply: boolean) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<ListImportOut>(`${A}/${enc(id)}/list-import?mode=${enc(mode)}&apply=${apply ? "true" : "false"}`, form);
  },
  listEntries: (id: string, mode: SourceMode, candidate_ids: string[]) =>
    api.post<AudienceOut>(`${A}/${enc(id)}/list-entries`, { mode, candidate_ids }),
};

export const audienceKeys = {
  all: ["marketing", "audiences"] as const,
  list: ["marketing", "audiences", "list"] as const,
  detail: (id: string) => ["marketing", "audiences", "detail", id] as const,
};
