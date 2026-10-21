/**
 * API client for the `/platform` operator console (Epic 12).
 *
 * - Operator endpoints live under `/api/v1/platform/*` and authenticate with the httpOnly
 *   `tos_platform` cookie (never the tenant `tos_session`); mutations echo `tos_csrf` like the tenant
 *   client (`apiRequest` does this).
 * - Calls never trigger the tenant app's global 401 handler (which would send an operator to the
 *   tenant `/login`). A 401 instead invokes the platform handler, which the console layout sets to
 *   redirect to `/platform/login?next=...`.
 */
import { apiRequest, type RequestOptions } from "./client";
import type {
  CompanyAdminOut,
  CompanyCreate,
  CompanyProvisionOut,
  IncidentCreate,
  IncidentNotificationOut,
  IncidentOut,
  MfaEnrollOut,
  MfaRequiredOut,
  MfaVerifyIn,
  OperatorLogin,
  OperatorOut,
  Page,
  PlatformNoticeCreate,
  PlatformNoticeOut,
  PlatformTenantCreate,
  PlatformTenantOut,
  RecoveryCodesOut,
  SubProcessorIn,
  SubProcessorOut,
  SubProcessorUpdate,
  SupportGrantOut,
  SupportRequestCreate,
  SupportSessionOut,
  TenantLifecycleOut,
  TenantOffboardIn,
} from "./types";
import { isApiError } from "./errors";

const enc = encodeURIComponent;
const P = "/api/v1/platform";

type Handler = () => void;
let platformUnauthorized: Handler | null = null;

/** Register the console's 401 handler; returns an unregister function. */
export function setPlatformUnauthorizedHandler(handler: Handler): () => void {
  platformUnauthorized = handler;
  return () => {
    if (platformUnauthorized === handler) platformUnauthorized = null;
  };
}

type Options = Omit<RequestOptions, "skipAuthHandler"> & {
  /** Sign-in calls report 401 as a form error instead of redirecting. */
  quiet401?: boolean;
};

export async function platformRequest<T>(path: string, options: Options = {}): Promise<T> {
  if (!path.startsWith(`${P}/`)) throw new Error(`platformRequest only accepts ${P}/ paths, got "${path}"`);
  const { quiet401, ...rest } = options;
  try {
    return await apiRequest<T>(path, { ...rest, skipAuthHandler: true });
  } catch (e) {
    if (!quiet401 && isApiError(e) && e.status === 401) platformUnauthorized?.();
    throw e;
  }
}

const get = <T>(path: string, signal?: AbortSignal) => platformRequest<T>(path, { signal });
const post = <T>(path: string, body?: unknown, opts: Options = {}) => platformRequest<T>(path, { ...opts, method: "POST", body });
const put = <T>(path: string, body?: unknown) => platformRequest<T>(path, { method: "PUT", body });
const patch = <T>(path: string, body?: unknown) => platformRequest<T>(path, { method: "PATCH", body });

export const platformApi = {
  // auth (story 1.4 operator sign-in)
  login: (body: OperatorLogin) => post<OperatorOut | MfaRequiredOut>(`${P}/auth/login`, body, { quiet401: true }),
  mfaVerify: (body: MfaVerifyIn) => post<OperatorOut>(`${P}/auth/mfa/verify`, body, { quiet401: true }),
  me: (signal?: AbortSignal) => platformRequest<OperatorOut>(`${P}/auth/me`, { signal, quiet401: true }),
  logout: () => post<void>(`${P}/auth/logout`, undefined, { quiet401: true }),
  mfaEnroll: () => post<MfaEnrollOut>(`${P}/auth/mfa/enroll`),
  mfaConfirm: (code: string) => post<RecoveryCodesOut>(`${P}/auth/mfa/enroll/confirm`, { code }),

  // tenants
  tenants: (page: number, pageSize: number, signal?: AbortSignal) =>
    get<Page<PlatformTenantOut>>(`${P}/tenants?page=${page}&page_size=${pageSize}`, signal),
  tenantsOverview: (page: number, pageSize: number, signal?: AbortSignal) =>
    get<Page<TenantLifecycleOut>>(`${P}/tenants-overview?page=${page}&page_size=${pageSize}`, signal),
  createTenant: (body: PlatformTenantCreate) => post<PlatformTenantOut>(`${P}/tenants`, body),
  // Super-admin cross-app provisioning: creates a company across every app (like self-serve) and returns
  // the admin invite link. `companies` enriches every company (incl. self-serve signups) with plan + admin email.
  createCompany: (body: CompanyCreate) => post<CompanyProvisionOut>(`${P}/companies`, body),
  companies: (signal?: AbortSignal) => get<CompanyAdminOut[]>(`${P}/companies`, signal),
  tenant: (id: string, signal?: AbortSignal) => get<PlatformTenantOut>(`${P}/tenants/${enc(id)}`, signal),
  tenantOverview: (id: string, signal?: AbortSignal) => get<TenantLifecycleOut>(`${P}/tenants/${enc(id)}/overview`, signal),
  lifecycle: (id: string, action: "suspend" | "reactivate" | "cancel-offboard", reason: string) =>
    post<TenantLifecycleOut>(`${P}/tenants/${enc(id)}/${action}`, { reason }),
  offboard: (id: string, body: TenantOffboardIn) => post<TenantLifecycleOut>(`${P}/tenants/${enc(id)}/offboard`, body),
  setAiBudget: (id: string, budget: number | null) =>
    put<TenantLifecycleOut>(`${P}/tenants/${enc(id)}/ai-budget`, { monthly_token_budget: budget }),
  resendAdminInvite: (id: string) => post<unknown>(`${P}/tenants/${enc(id)}/invitations/resend`),
  revokeAdminInvite: (id: string) => post<void>(`${P}/tenants/${enc(id)}/invitations/revoke`),

  // support access
  requestSupport: (tenantId: string, body: SupportRequestCreate) =>
    post<SupportGrantOut>(`${P}/tenants/${enc(tenantId)}/support-requests`, body),
  supportRequests: (mine: boolean, signal?: AbortSignal) => get<SupportGrantOut[]>(`${P}/support-requests?mine=${mine}`, signal),
  cancelSupport: (id: string) => post<SupportGrantOut>(`${P}/support-requests/${enc(id)}/cancel`),
  startSupportSession: (id: string) => post<SupportSessionOut>(`${P}/support-requests/${enc(id)}/session`),

  // incidents
  incidents: (page: number, pageSize: number, signal?: AbortSignal) =>
    get<Page<IncidentOut>>(`${P}/incidents?page=${page}&page_size=${pageSize}`, signal),
  createIncident: (body: IncidentCreate) => post<IncidentOut>(`${P}/incidents`, body),
  notifyIncident: (id: string, tenantIds: string[]) =>
    post<IncidentNotificationOut[]>(`${P}/incidents/${enc(id)}/notify`, { tenant_ids: tenantIds, template_key: "incident_notice" }),
  incidentNotifications: (id: string, signal?: AbortSignal) =>
    get<IncidentNotificationOut[]>(`${P}/incidents/${enc(id)}/notifications`, signal),

  // sub-processors
  subProcessors: (signal?: AbortSignal) => get<SubProcessorOut[]>(`${P}/sub-processors`, signal),
  createSubProcessor: (body: SubProcessorIn) => post<SubProcessorOut>(`${P}/sub-processors`, body),
  updateSubProcessor: (id: string, body: SubProcessorUpdate) => patch<SubProcessorOut>(`${P}/sub-processors/${enc(id)}`, body),

  // notices
  notices: (signal?: AbortSignal) => get<PlatformNoticeOut[]>(`${P}/notices`, signal),
  createNotice: (body: PlatformNoticeCreate) => post<PlatformNoticeOut>(`${P}/notices`, body),
};

export const platformKeys = {
  all: ["platform"] as const,
  me: ["platform", "me"] as const,
  mfaProbe: ["platform", "mfa-probe"] as const,
  tenants: ["platform", "tenants"] as const,
  companies: ["platform", "companies"] as const,
  tenantList: (page: number) => ["platform", "tenants", "list", page] as const,
  tenant: (id: string) => ["platform", "tenants", "detail", id] as const,
  support: ["platform", "support"] as const,
  incidents: ["platform", "incidents"] as const,
  incidentNotifications: (id: string) => ["platform", "incidents", id, "notifications"] as const,
  subProcessors: ["platform", "sub-processors"] as const,
  notices: ["platform", "notices"] as const,
};
