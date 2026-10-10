import { api } from "@/lib/api/client";
import type { Page, TaskCreate, TaskOut, TaskSummaryOut, TaskUpdate } from "@/lib/api/types";

const enc = encodeURIComponent;
const T = "/api/v1/tasks";

/** Tasks (Epic 10, story 10.2). */
export const tasksApi = {
  list: (query: string, signal?: AbortSignal) => api.get<Page<TaskOut>>(`${T}?${query}`, { signal }),
  summary: (signal?: AbortSignal) => api.get<TaskSummaryOut>(`${T}/summary`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<TaskOut>(`${T}/${enc(id)}`, { signal }),
  create: (body: TaskCreate) => api.post<TaskOut>(T, body),
  update: (id: string, body: TaskUpdate) => api.patch<TaskOut>(`${T}/${enc(id)}`, body),
  remove: (id: string) => api.delete<void>(`${T}/${enc(id)}`),
  complete: (id: string) => api.post<TaskOut>(`${T}/${enc(id)}/complete`),
  reopen: (id: string) => api.post<TaskOut>(`${T}/${enc(id)}/reopen`),
  forEntity: (entity: string, id: string, signal?: AbortSignal) =>
    api.get<Page<TaskOut>>(`/api/v1/${enc(entity)}/${enc(id)}/tasks?page=1&page_size=100`, { signal }),
};

export const taskKeys = {
  all: ["tasks"] as const,
  lists: ["tasks", "list"] as const,
  list: (query: string) => ["tasks", "list", query] as const,
  entity: (entity: string, id: string) => ["tasks", "list", "entity", entity, id] as const,
  summary: ["tasks", "summary"] as const,
  counts: ["tasks", "counts"] as const,
};
