import { api } from "@/lib/api/client";
import { pageParams } from "@/features/admin/query";
import type { Page, PendingSkillOut, SkillCreate, SkillOut, SkillRefIn } from "@/lib/api/types";

const enc = encodeURIComponent;
const S = "/api/v1/skills";

export const skillsApi = {
  search: (q: string, includePending: boolean, page: number, pageSize: number, signal?: AbortSignal) => {
    const params = pageParams(page, pageSize);
    if (q.trim()) params.set("q", q.trim().slice(0, 200));
    if (includePending) params.set("include_pending", "true");
    return api.get<Page<SkillOut>>(`${S}?${params}`, { signal });
  },
  create: (body: SkillCreate) => api.post<SkillOut>(S, body),
  addAlias: (kind: SkillOut["kind"], id: string, alias: string) =>
    api.post<SkillOut>(`${S}/${enc(kind)}/${enc(id)}/aliases`, { alias }),
  pending: (page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Page<PendingSkillOut>>(`${S}/pending?${pageParams(page, pageSize)}`, { signal }),
  approve: (id: string) => api.post<SkillOut>(`${S}/${enc(id)}/approve`),
  reject: (id: string, mergeInto: SkillRefIn | null) =>
    api.post<SkillOut>(`${S}/${enc(id)}/reject`, mergeInto ? { merge_into: mergeInto } : {}),
};

export const skillKeys = {
  all: ["skills"] as const,
  search: (q: string, includePending: boolean, page: number) => ["skills", "catalog", q, includePending, page] as const,
  pending: (page: number) => ["skills", "pending", page] as const,
};

/** "a, b ,, c" -> ["a", "b", "c"] (trimmed, de-duplicated case-insensitively, max 200 chars each). */
export function parseAliases(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[,\n]/)) {
    const a = raw.trim().slice(0, 200);
    if (!a || seen.has(a.toLowerCase())) continue;
    seen.add(a.toLowerCase());
    out.push(a);
  }
  return out;
}
