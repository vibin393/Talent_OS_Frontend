import { api } from "@/lib/api/client";
import type { Page, SkillOut } from "@/lib/api/types";
import type {
  Evidence,
  ExpandPreview,
  SkillEdge,
  SkillEdgeIn,
  SkillGraphSettings,
  SkillInsights,
  SkillNode,
  SkillProfileRow,
  SkillSuggestion,
} from "./types";

const enc = encodeURIComponent;
const G = "/api/v1/skill-graph";
const C = "/api/v1/candidates";

export const skillGraphApi = {
  search: (q: string, signal?: AbortSignal) =>
    api.get<Page<SkillOut>>(`${G}/search?${new URLSearchParams({ q: q.slice(0, 200), page_size: "20" })}`, { signal }),
  node: (key: string, signal?: AbortSignal) => api.get<SkillNode>(`${G}/skills/${enc(key)}`, { signal }),
  createEdge: (body: SkillEdgeIn) => api.post<SkillEdge>(`${G}/edges`, body),
  updateEdge: (id: string, body: { weight?: string; note?: string | null }) =>
    api.patch<SkillEdge>(`${G}/edges/${enc(id)}`, body),
  deleteEdge: (id: string) => api.delete<void>(`${G}/edges/${enc(id)}`),
  settings: (signal?: AbortSignal) => api.get<SkillGraphSettings>(`${G}/settings`, { signal }),
  saveSettings: (body: Partial<Omit<SkillGraphSettings, "graph_version">>) =>
    api.put<SkillGraphSettings>(`${G}/settings`, body),
  preview: (refs: string[], depth: number) => api.post<ExpandPreview>(`${G}/expand-preview`, { refs, depth }),
  // ---- candidate evidence and suggestions
  profile: (cid: string, signal?: AbortSignal) => api.get<SkillProfileRow[]>(`${C}/${enc(cid)}/skill-profile`, { signal }),
  evidence: (cid: string, csid: string, signal?: AbortSignal) =>
    api.get<Evidence[]>(`${C}/${enc(cid)}/skills/${enc(csid)}/evidence`, { signal }),
  addEvidence: (cid: string, csid: string, body: { kind: "recruiter" | "self"; proficiency: number | null; note?: string | null }) =>
    api.post<Evidence>(`${C}/${enc(cid)}/skills/${enc(csid)}/evidence`, body),
  supersede: (cid: string, csid: string, evidenceId: string) =>
    api.post<Evidence>(`${C}/${enc(cid)}/skills/${enc(csid)}/evidence/${enc(evidenceId)}/supersede`),
  suggestions: (cid: string, signal?: AbortSignal) =>
    api.get<SkillSuggestion[]>(`${C}/${enc(cid)}/skill-suggestions?status=pending`, { signal }),
  accept: (cid: string, sid: string, proficiency: number | null) =>
    api.post<SkillSuggestion>(`${C}/${enc(cid)}/skill-suggestions/${enc(sid)}/accept`, proficiency ? { proficiency } : {}),
  reject: (cid: string, sid: string) =>
    api.post<SkillSuggestion>(`${C}/${enc(cid)}/skill-suggestions/${enc(sid)}/reject`, {}),
  insights: (params: { category?: string }, signal?: AbortSignal) => {
    const q = new URLSearchParams();
    if (params.category) q.set("category", params.category);
    return api.get<SkillInsights>(`/api/v1/skills/insights?${q}`, { signal });
  },
};

export const skillGraphKeys = {
  node: (key: string) => ["skill-graph", "node", key] as const,
  search: (q: string) => ["skill-graph", "search", q] as const,
  settings: ["skill-graph", "settings"] as const,
  preview: (refs: string, depth: number) => ["skill-graph", "preview", refs, depth] as const,
  profile: (cid: string) => ["skill-graph", "profile", cid] as const,
  evidence: (cid: string, csid: string) => ["skill-graph", "evidence", cid, csid] as const,
  suggestions: (cid: string) => ["skill-graph", "suggestions", cid] as const,
  insights: (category: string) => ["skill-graph", "insights", category] as const,
};
