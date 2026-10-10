import { CLIENT_PORTAL_PREFIX, clientPortalRequest } from "@/lib/api/client-portal-client";
import { api } from "@/lib/api/client";
import type {
  AssignmentIn,
  AssignmentOut,
  BudgetDimension,
  BudgetOut,
  BurnOut,
  DeliverableIn,
  DeliverableOut,
  PortalProjectDetail,
  PortalProjectSummary,
  Project360,
  ProjectFilters,
  ProjectIn,
  ProjectListItem,
  ProjectOut,
  ProjectRoleIn,
  ProjectRoleOut,
  ProjectRoleUpdate,
  ProjectStatus,
  ProjectUpdate,
  ResourceTimeline,
} from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";

function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "" && v !== false) q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export type CreatedDemand = { id: string; human_id?: string | null };

export const projectsApi = {
  list: (filters: ProjectFilters, signal?: AbortSignal) => api.get<ProjectListItem[]>(`${V}/projects${query(filters)}`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<ProjectOut>(`${V}/projects/${enc(id)}`, { signal }),
  create: (body: ProjectIn) => api.post<ProjectOut>(`${V}/projects`, body),
  update: (id: string, body: ProjectUpdate) => api.patch<ProjectOut>(`${V}/projects/${enc(id)}`, body),
  transition: (id: string, to: ProjectStatus) => api.post<ProjectOut>(`${V}/projects/${enc(id)}/transition`, { to }),
  view360: (id: string, signal?: AbortSignal) => api.get<Project360>(`${V}/projects/${enc(id)}/360`, { signal }),
  timeline: (id: string, from: string, to: string, signal?: AbortSignal) =>
    api.get<ResourceTimeline>(`${V}/projects/${enc(id)}/resource-timeline${query({ from, to })}`, { signal }),

  // roles & assignments
  roles: (id: string, signal?: AbortSignal) => api.get<ProjectRoleOut[]>(`${V}/projects/${enc(id)}/roles`, { signal }),
  addRole: (id: string, body: ProjectRoleIn) => api.post<ProjectRoleOut>(`${V}/projects/${enc(id)}/roles`, body),
  updateRole: (roleId: string, body: ProjectRoleUpdate) => api.patch<ProjectRoleOut>(`${V}/project-roles/${enc(roleId)}`, body),
  deleteRole: (roleId: string) => api.delete<void>(`${V}/project-roles/${enc(roleId)}`),
  createDemand: (id: string, roleId: string, positions?: number) =>
    api.post<CreatedDemand>(`${V}/projects/${enc(id)}/roles/${enc(roleId)}/demand`, positions ? { positions } : {}),
  assignments: (id: string, signal?: AbortSignal) => api.get<AssignmentOut[]>(`${V}/projects/${enc(id)}/assignments`, { signal }),
  assign: (roleId: string, body: AssignmentIn) => api.post<AssignmentOut>(`${V}/project-roles/${enc(roleId)}/assignments`, body),
  endAssignment: (assignmentId: string, end_date: string, reason?: string | null) =>
    api.post<AssignmentOut>(`${V}/project-assignments/${enc(assignmentId)}/end`, { end_date, reason: reason || null }),

  // deliverables
  deliverables: (id: string, signal?: AbortSignal) => api.get<DeliverableOut[]>(`${V}/projects/${enc(id)}/deliverables`, { signal }),
  deliverable: (id: string, signal?: AbortSignal) => api.get<DeliverableOut>(`${V}/deliverables/${enc(id)}`, { signal }),
  addDeliverable: (projectId: string, body: DeliverableIn) => api.post<DeliverableOut>(`${V}/projects/${enc(projectId)}/deliverables`, body),
  updateDeliverable: (id: string, body: Partial<DeliverableIn> & { lock_version?: number }) =>
    api.patch<DeliverableOut>(`${V}/deliverables/${enc(id)}`, body),
  deliverableAction: (id: string, action: "start" | "submit" | "cancel") => api.post<DeliverableOut>(`${V}/deliverables/${enc(id)}/${action}`),
  recordAcceptance: (id: string, file: File, contactId?: string | null) => {
    const form = new FormData();
    form.append("file", file);
    if (contactId) form.append("accepted_by_contact_id", contactId);
    return api.post<DeliverableOut>(`${V}/deliverables/${enc(id)}/record-acceptance`, form);
  },
  recordRejection: (id: string, reason: string) => api.post<DeliverableOut>(`${V}/deliverables/${enc(id)}/record-rejection`, { reason }),

  // budgets & burn
  budgets: (id: string, signal?: AbortSignal) => api.get<BudgetOut[]>(`${V}/projects/${enc(id)}/budgets`, { signal }),
  putBudgets: (id: string, budgets: { dimension: BudgetDimension; amount: string }[]) =>
    api.put<BudgetOut[]>(`${V}/projects/${enc(id)}/budgets`, { budgets }),
  burn: (id: string, signal?: AbortSignal) => api.get<BurnOut[]>(`${V}/projects/${enc(id)}/burn`, { signal }),
  rebuildBurn: (id: string) => api.post<BurnOut[]>(`${V}/projects/${enc(id)}/burn/rebuild`),
};

export const projectKeys = {
  all: ["projects"] as const,
  list: (filters: ProjectFilters) => ["projects", "list", filters] as const,
  detail: (id: string) => ["projects", "detail", id] as const,
  view360: (id: string) => ["projects", "detail", id, "360"] as const,
  timeline: (id: string, from: string, to: string) => ["projects", "detail", id, "timeline", from, to] as const,
  deliverable: (id: string) => ["projects", "deliverable", id] as const,
};

// ---------------------------------------------------------------- client portal
const P = CLIENT_PORTAL_PREFIX;

export const portalProjectsApi = {
  list: (signal?: AbortSignal) => clientPortalRequest<PortalProjectSummary[]>(`${P}/projects`, { signal }),
  get: (id: string, signal?: AbortSignal) => clientPortalRequest<PortalProjectDetail>(`${P}/projects/${enc(id)}`, { signal }),
  accept: (deliverableId: string) => clientPortalRequest<unknown>(`${P}/deliverables/${enc(deliverableId)}/accept`, { method: "POST" }),
  reject: (deliverableId: string, reason: string) =>
    clientPortalRequest<unknown>(`${P}/deliverables/${enc(deliverableId)}/reject`, { method: "POST", body: { reason } }),
};

export const portalProjectKeys = {
  list: ["client-portal", "projects"] as const,
  detail: (id: string) => ["client-portal", "projects", id] as const,
};
