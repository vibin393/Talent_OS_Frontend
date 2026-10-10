import { api } from "@/lib/api/client";
import type {
  AdminUserOut,
  AuditLogOut,
  BusinessUnitCreate,
  BusinessUnitOut,
  BusinessUnitUpdate,
  InvitationAdminOut,
  Page,
  PermissionOut,
  RoleCreate,
  RoleOut,
  RoleUpdate,
  TeamCreate,
  TeamDetailOut,
  TeamOut,
  TeamUpdate,
  UserInvite,
  UserUpdate,
} from "@/lib/api/types";
import { type AuditFilters, auditListQuery } from "./audit-format";
import { MAX_PAGE_SIZE, pageParams, type UserListFilters, userListQuery } from "./query";

const enc = encodeURIComponent;
const A = "/api/v1/admin";

export const adminApi = {
  permissions: (signal?: AbortSignal) => api.get<PermissionOut[]>("/api/v1/permissions", { signal }),

  listUsers: (filters: UserListFilters, page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Page<AdminUserOut>>(`${A}/users?${userListQuery(filters, page, pageSize)}`, { signal }),
  inviteUser: (body: UserInvite) => api.post<InvitationAdminOut>(`${A}/users/invite`, body),
  updateUser: (id: string, body: UserUpdate) => api.patch<AdminUserOut>(`${A}/users/${enc(id)}`, body),
  deactivateUser: (id: string) => api.post<AdminUserOut>(`${A}/users/${enc(id)}/deactivate`),
  reactivateUser: (id: string) => api.post<AdminUserOut>(`${A}/users/${enc(id)}/reactivate`),

  listInvitations: (page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Page<InvitationAdminOut>>(`${A}/invitations?${pageParams(page, pageSize)}`, { signal }),
  resendInvitation: (id: string) => api.post<InvitationAdminOut>(`${A}/invitations/${enc(id)}/resend`),
  revokeInvitation: (id: string) => api.post<void>(`${A}/invitations/${enc(id)}/revoke`),

  listRoles: (signal?: AbortSignal) => api.get<RoleOut[]>(`${A}/roles`, { signal }),
  createRole: (body: RoleCreate) => api.post<RoleOut>(`${A}/roles`, body),
  updateRole: (id: string, body: RoleUpdate) => api.patch<RoleOut>(`${A}/roles/${enc(id)}`, body),
  deleteRole: (id: string) => api.delete<void>(`${A}/roles/${enc(id)}`),

  listTeams: (page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Page<TeamOut>>(`${A}/teams?${pageParams(page, pageSize)}`, { signal }),
  getTeam: (id: string, signal?: AbortSignal) => api.get<TeamDetailOut>(`${A}/teams/${enc(id)}`, { signal }),
  createTeam: (body: TeamCreate) => api.post<TeamDetailOut>(`${A}/teams`, body),
  updateTeam: (id: string, body: TeamUpdate) => api.patch<TeamDetailOut>(`${A}/teams/${enc(id)}`, body),
  deleteTeam: (id: string) => api.delete<void>(`${A}/teams/${enc(id)}`),
  setTeamMember: (teamId: string, userId: string, isLead: boolean) =>
    api.put<TeamDetailOut>(`${A}/teams/${enc(teamId)}/members/${enc(userId)}`, { is_lead: isLead }),
  removeTeamMember: (teamId: string, userId: string) =>
    api.delete<void>(`${A}/teams/${enc(teamId)}/members/${enc(userId)}`),

  listBusinessUnits: (page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Page<BusinessUnitOut>>(`${A}/business-units?${pageParams(page, pageSize)}`, { signal }),
  createBusinessUnit: (body: BusinessUnitCreate) => api.post<BusinessUnitOut>(`${A}/business-units`, body),
  updateBusinessUnit: (id: string, body: BusinessUnitUpdate) =>
    api.patch<BusinessUnitOut>(`${A}/business-units/${enc(id)}`, body),
  deleteBusinessUnit: (id: string) => api.delete<void>(`${A}/business-units/${enc(id)}`),

  listAuditLogs: (filters: AuditFilters, page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Page<AuditLogOut>>(`${A}/audit-logs?${auditListQuery(filters, page, pageSize)}`, { signal }),
};

export const adminKeys = {
  all: ["admin"] as const,
  permissions: ["admin", "permissions"] as const,
  users: ["admin", "users"] as const,
  userList: (filters: UserListFilters, page: number, pageSize: number) =>
    ["admin", "users", "list", filters, page, pageSize] as const,
  userSearch: (q: string) => ["admin", "users", "search", q] as const,
  invitations: ["admin", "invitations"] as const,
  invitationList: (page: number, pageSize: number) => ["admin", "invitations", page, pageSize] as const,
  roles: ["admin", "roles"] as const,
  teams: ["admin", "teams"] as const,
  teamList: (page: number, pageSize: number) => ["admin", "teams", "list", page, pageSize] as const,
  team: (id: string) => ["admin", "teams", "detail", id] as const,
  businessUnits: ["admin", "business-units"] as const,
  businessUnitList: (page: number, pageSize: number) => ["admin", "business-units", page, pageSize] as const,
  auditLogs: ["admin", "audit-logs"] as const,
  auditLogList: (filters: AuditFilters, page: number, pageSize: number) =>
    ["admin", "audit-logs", filters, page, pageSize] as const,
};

/** Lookups for pickers load one page of the maximum size. */
export const LOOKUP_PAGE_SIZE = MAX_PAGE_SIZE;
