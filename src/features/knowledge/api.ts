/** Epic 62 Knowledge Sources admin, FAQ gaps and the coordinators' onboarding question inbox. */
import { api } from "@/lib/api/client";
import type { Audience, GapRow, QaThreadOut, SearchHitOut, SourceCreate, SourceDetailOut, SourceOut, VersionOut } from "./types";

const enc = encodeURIComponent;
const S = "/api/v1/knowledge/sources";

export type InboxView = "waiting" | "answered" | "all";

export const knowledgeApi = {
  list: (signal?: AbortSignal) => api.get<SourceOut[]>(S, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<SourceDetailOut>(`${S}/${enc(id)}`, { signal }),
  create: (data: SourceCreate) => api.post<SourceDetailOut>(S, data),
  upload: (title: string, audience: Audience, file: File) => {
    const form = new FormData();
    form.set("title", title);
    form.set("audience", audience);
    form.set("file", file);
    return api.post<SourceDetailOut>(`${S}/upload`, form);
  },
  newVersion: (id: string, bodyMd: string) => api.post<VersionOut>(`${S}/${enc(id)}/versions`, { body_md: bodyMd }),
  publish: (id: string, versionNo: number) => api.post<SourceDetailOut>(`${S}/${enc(id)}/publish`, { version_no: versionNo }),
  unpublish: (id: string) => api.post<SourceDetailOut>(`${S}/${enc(id)}/unpublish`),
  archive: (id: string) => api.post<SourceDetailOut>(`${S}/${enc(id)}/archive`),
  importOnboarding: () => api.post<{ created: number; skipped: number; source_ids: string[] }>("/api/v1/knowledge/import-onboarding"),
  searchPreview: (query: string, audience: "worker" | "candidate" | "internal") =>
    api.post<SearchHitOut[]>("/api/v1/knowledge/search-preview", { query, audience }),
  gaps: (signal?: AbortSignal) => api.get<GapRow[]>("/api/v1/knowledge/gaps", { signal }),
  threads: (view: InboxView, signal?: AbortSignal) =>
    api.get<QaThreadOut[]>(`/api/v1/onboarding-qa/threads?view=${enc(view)}`, { signal }),
  thread: (id: string, signal?: AbortSignal) => api.get<QaThreadOut>(`/api/v1/onboarding-qa/threads/${enc(id)}`, { signal }),
  reply: (id: string, text: string) => api.post<QaThreadOut>(`/api/v1/onboarding-qa/threads/${enc(id)}/reply`, { text }),
  close: (id: string) => api.post<QaThreadOut>(`/api/v1/onboarding-qa/threads/${enc(id)}/close`),
};

export const knowledgeKeys = {
  list: ["knowledge", "sources"] as const,
  source: (id: string) => ["knowledge", "source", id] as const,
  gaps: ["knowledge", "gaps"] as const,
  threads: (view: InboxView) => ["knowledge", "threads", view] as const,
  thread: (id: string) => ["knowledge", "thread", id] as const,
};
