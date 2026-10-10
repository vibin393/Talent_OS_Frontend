import { api } from "@/lib/api/client";
import type { CandidateSearchIn, CandidateSearchOut, GlobalSearchOut, Page, TagOut } from "@/lib/api/types";

export const searchApi = {
  candidates: (body: CandidateSearchIn, signal?: AbortSignal) =>
    api.post<CandidateSearchOut>("/api/v1/search/candidates", body, { signal }),
  global: (q: string, limit = 5, signal?: AbortSignal) =>
    api.get<GlobalSearchOut>(`/api/v1/search/global?q=${encodeURIComponent(q.slice(0, 200))}&limit=${limit}`, { signal }),
  tags: (signal?: AbortSignal) => api.get<Page<TagOut>>("/api/v1/tags?page=1&page_size=100", { signal }),
};

export const searchKeys = {
  all: ["search"] as const,
  candidates: (body: CandidateSearchIn) => ["search", "candidates", body] as const,
  global: (q: string) => ["search", "global", q] as const,
  tags: ["search", "tags"] as const,
};
