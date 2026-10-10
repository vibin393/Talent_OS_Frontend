/** Internal onboarding API (Epic 23): templates, settings, the board, cases and task review. */
import { api } from "@/lib/api/client";
import type {
  BoardRow,
  BulkResult,
  OnboardingCase,
  OnboardingSettings,
  OnboardingTask,
  OnboardingTemplate,
  TemplateIn,
  TemplateTask,
  UnmatchedPlacement,
} from "./types";

const enc = encodeURIComponent;
const O = "/api/v1/onboarding";
const C = "/api/v1/onboarding-cases";
const T = "/api/v1/onboarding-tasks";

export type BoardFilters = { starts_within?: number | null; status?: string[]; owner?: string | null };

export function boardQuery(f: BoardFilters): string {
  const q = new URLSearchParams();
  if (f.starts_within !== undefined && f.starts_within !== null) q.set("starts_within", String(f.starts_within));
  (f.status ?? []).forEach((s) => q.append("status", s));
  if (f.owner) q.set("owner", f.owner);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const onboardingApi = {
  settings: (signal?: AbortSignal) => api.get<OnboardingSettings>(`${O}/settings`, { signal }),
  updateSettings: (body: Partial<OnboardingSettings>) => api.patch<OnboardingSettings>(`${O}/settings`, body),
  templates: (includeArchived = false, signal?: AbortSignal) =>
    api.get<OnboardingTemplate[]>(`${O}/templates${includeArchived ? "?include_archived=true" : ""}`, { signal }),
  createTemplate: (body: TemplateIn) => api.post<OnboardingTemplate>(`${O}/templates`, body),
  patchTemplate: (id: string, body: Partial<TemplateIn> & { archived?: boolean }) =>
    api.patch<OnboardingTemplate>(`${O}/templates/${enc(id)}`, body),
  putTasks: (id: string, tasks: TemplateTask[]) => api.put<OnboardingTemplate>(`${O}/templates/${enc(id)}/tasks`, { tasks }),
  match: (placementId: string) =>
    api.get<{ placement_id: string; template_id: string | null; template_name: string | null }>(
      `${O}/templates/match?placement_id=${enc(placementId)}`,
    ),
  board: (f: BoardFilters, signal?: AbortSignal) => api.get<BoardRow[]>(`${C}${boardQuery(f)}`, { signal }),
  unmatched: (signal?: AbortSignal) => api.get<UnmatchedPlacement[]>(`${C}/unmatched`, { signal }),
  start: (placementId: string) => api.post<OnboardingCase>(C, { placement_id: placementId }),
  get: (id: string, signal?: AbortSignal) => api.get<OnboardingCase>(`${C}/${enc(id)}`, { signal }),
  byPlacement: (placementId: string, signal?: AbortSignal) =>
    api.get<OnboardingCase>(`${C}/by-placement/${enc(placementId)}`, { signal }),
  invite: (id: string) => api.post<{ invited_at: string }>(`${C}/${enc(id)}/invite`),
  bulkApprove: (id: string, taskIds: string[]) => api.post<BulkResult>(`${C}/${enc(id)}/approve`, { task_ids: taskIds }),
  approve: (taskId: string, body: { pan_name_checked?: boolean } = {}) => api.post<OnboardingTask>(`${T}/${enc(taskId)}/approve`, body),
  returnTask: (taskId: string, comment: string) => api.post<OnboardingTask>(`${T}/${enc(taskId)}/return`, { comment }),
  waive: (taskId: string, reason: string) => api.post<OnboardingTask>(`${T}/${enc(taskId)}/waive`, { reason }),
  confirmRedaction: (taskId: string) => api.post<OnboardingTask>(`${T}/${enc(taskId)}/confirm-redaction`),
  reissueSignature: (taskId: string) => api.post<OnboardingTask>(`${T}/${enc(taskId)}/reissue-signature`),
};

export const onboardingKeys = {
  all: ["onboarding"] as const,
  settings: ["onboarding", "settings"] as const,
  templates: (archived: boolean) => ["onboarding", "templates", archived] as const,
  board: (f: BoardFilters) => ["onboarding", "board", f] as const,
  unmatched: ["onboarding", "unmatched"] as const,
  case: (id: string) => ["onboarding", "case", id] as const,
  byPlacement: (id: string) => ["onboarding", "by-placement", id] as const,
};
