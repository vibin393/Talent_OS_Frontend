/**
 * Developer portal API client (Epic 74). Developer sessions use the httpOnly `tos_developer` cookie and the readable
 * `tos_csrf` (echoed by `apiRequest`); the selected organisation travels in `X-Partner-Org`. Calls never trigger the
 * tenant app's 401 handler. DTOs are hand-written.
 */
import { apiRequest, type RequestOptions } from "@/lib/api/client";
import type { OrgRole } from "./logic";

const DEV = "/api/v1/developer";

export type OrgOut = {
  id: string;
  name: string;
  slug: string;
  status: string;
  verification_status: string;
  verification_expires_at: string | null;
  role: OrgRole | null;
};
export type MeOut = { id: string; email: string; name: string; mfa_enabled: boolean; orgs: OrgOut[] };
export type SandboxOut = {
  id: string;
  name: string;
  size: "small" | "medium";
  status: string;
  tenant_slug: string | null;
  created_at: string;
  last_reset_at: string | null;
};
export type AppOut = {
  id: string;
  client_id: string;
  name: string;
  status: string;
  manifest_version: number;
  client_type?: string;
  grant_types?: string[];
  requested_scopes?: string[];
  listing_id?: string | null;
  current_version_id?: string | null;
};
export type AppCreated = AppOut & { client_secret: string | null };
export type MemberOut = { account_id: string; name: string; email: string; role: OrgRole; joined_at: string };
export type RunOut = {
  id: string;
  status: string;
  window_ends_at: string;
  created_at: string;
  manifest_sha256: string;
  checks: { key: string; passed: boolean | null; detail: string | null }[];
  report_available: boolean;
};
export type TokenOut = { access_token: string; expires_in: number; scope: string; tenant_slug: string; refresh_token?: string | null };

export type UsageDay = { day: string; requests: number; errors: number; webhook_attempts: number; webhook_failures: number; deprecated_calls: number };
export type UsageTenantRow = { label: string; requests: number };
export type AppUsageOut = {
  app_id: string;
  date_from: string;
  date_to: string;
  installs_total: number;
  installs_active: number;
  requests: number;
  error_rate: number;
  webhook_attempts: number;
  webhook_success_rate: number | null;
  deprecated_calls: number;
  days: UsageDay[];
  tenants: UsageTenantRow[];
};

export type CheckResultOut = { key: string; passed: boolean; detail: string | null };
export type VersionOut = {
  id: string;
  listing_id: string;
  version_no: number;
  status: string;
  manifest_version: number;
  manifest_sha256: string;
  description_md: string;
  screenshots: string[];
  privacy_url: string | null;
  dpa_url: string | null;
  india_transfer_statement: string | null;
  changelog: string | null;
  check_results: CheckResultOut[];
  submitted_at: string | null;
  decided_at: string | null;
};
export type PartnerListingOut = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  status: string;
  app_id: string | null;
  current_version_id: string | null;
  install_count: number;
  last_reviewed_at: string | null;
};
export type SubmissionRow = {
  app_name?: string;
  listing_name?: string;
  version_no?: number;
  status?: string;
  submitted_at?: string | null;
  updated_at?: string | null;
  version_id?: string;
  check_results?: CheckResultOut[];
  reviewer_messages?: { action: string; message: string | null; at: string }[];
  [k: string]: unknown;
};

export type ListingDraftIn = {
  slug: string;
  name: string;
  tagline: string;
  category?: string;
  support_email?: string | null;
  support_url?: string | null;
};
export type VersionDraftIn = {
  description_md?: string;
  screenshots?: string[];
  privacy_url?: string | null;
  dpa_url?: string | null;
  india_transfer_statement?: string | null;
  changelog?: string | null;
};

let currentOrg: string | null = null;
export function selectOrg(id: string | null): void {
  currentOrg = id;
}

function req<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = { ...(options.headers ?? {}), ...(currentOrg ? { "X-Partner-Org": currentOrg } : {}) };
  return apiRequest<T>(`${DEV}${path}`, { ...options, headers, skipAuthHandler: true });
}

export const devApi = {
  signup: (body: { email: string; name: string; password: string; accept_terms_version: string }) =>
    req<{ status: string }>("/auth/signup", { method: "POST", body }),
  verifyEmail: (token: string) => req<void>("/auth/verify-email", { method: "POST", body: { token } }),
  login: (email: string, password: string) =>
    req<{ step: "mfa_required" | "enroll_required" }>("/auth/login", { method: "POST", body: { email, password } }),
  enrollStart: () => req<{ otpauth_uri: string; secret_display: string }>("/auth/mfa/enroll/start", { method: "POST" }),
  enrollConfirm: (code: string) =>
    req<{ recovery_codes: string[] }>("/auth/mfa/enroll/confirm", { method: "POST", body: { code } }),
  mfaVerify: (body: { code?: string; recovery_code?: string }) =>
    req<{ account: MeOut }>("/auth/mfa/verify", { method: "POST", body }),
  logout: () => req<void>("/auth/logout", { method: "POST" }),
  me: () => req<MeOut>("/me"),
  createOrg: (name: string, slug: string) => req<OrgOut>("/orgs", { method: "POST", body: { name, slug } }),
  members: (org: string) => req<MemberOut[]>(`/orgs/${org}/members`),
  invite: (org: string, email: string, role: OrgRole) =>
    req<unknown>(`/orgs/${org}/invitations`, { method: "POST", body: { email, role } }),
  acceptInvitation: (token: string) => req<OrgOut>("/invitations/accept", { method: "POST", body: { token } }),
  apps: (org: string) => req<AppOut[]>(`/orgs/${org}/apps`),
  createApp: (org: string, body: Record<string, unknown>) =>
    req<AppCreated>(`/orgs/${org}/apps`, { method: "POST", body }),
  rotateSecret: (app: string) =>
    req<{ client_secret: string }>(`/apps/${app}/secrets/rotate`, { method: "POST" }),
  sandboxes: (org: string) => req<SandboxOut[]>(`/orgs/${org}/sandboxes`),
  createSandbox: (org: string, name: string, size: "small" | "medium") =>
    req<SandboxOut>(`/orgs/${org}/sandboxes`, { method: "POST", body: { name, size } }),
  resetSandbox: (id: string, reinstall_apps: boolean) =>
    req<SandboxOut>(`/sandboxes/${id}/reset`, { method: "POST", body: { reinstall_apps } }),
  deleteSandbox: (id: string) => req<SandboxOut>(`/sandboxes/${id}`, { method: "DELETE" }),
  openSandbox: (id: string) => req<{ url: string }>(`/sandboxes/${id}/open`, { method: "POST" }),
  installInSandbox: (id: string, app_id: string, scopes: string[]) =>
    req<unknown>(`/sandboxes/${id}/installations`, { method: "POST", body: { app_id, scopes } }),
  handoff: (t: string) => req<{ redirect: string }>("/sandbox-handoff", { method: "POST", body: { t } }),
  playgroundToken: (app_id: string, sandbox_id: string, client_secret: string) =>
    req<TokenOut>("/playground/token", { method: "POST", body: { app_id, sandbox_id, client_secret } }),
  startRun: (app: string, sandbox_id: string) =>
    req<RunOut>(`/apps/${app}/conformance-runs`, { method: "POST", body: { sandbox_id } }),
  run: (id: string) => req<RunOut>(`/conformance-runs/${id}`),
  finishRun: (id: string) => req<RunOut>(`/conformance-runs/${id}/finish`, { method: "POST" }),
  runHistory: (app: string) => req<RunOut[]>(`/apps/${app}/conformance-runs`),
  submissions: (org: string) => req<SubmissionRow[]>(`/orgs/${org}/submissions`),
  getApp: (app: string) => req<AppOut>(`/apps/${app}`),
  retireApp: (app: string, reason: string) => req<AppOut>(`/apps/${app}/retire`, { method: "POST", body: { reason } }),
  usage: (app: string, from: string, to: string) => req<AppUsageOut>(`/apps/${app}/usage?from=${from}&to=${to}`),
  listingDraft: (app: string, body: ListingDraftIn) => req<PartnerListingOut>(`/apps/${app}/listing`, { method: "POST", body }),
  saveVersion: (listingId: string, body: VersionDraftIn) => req<VersionOut>(`/listings/${listingId}/versions`, { method: "PUT", body }),
  submitVersion: (versionId: string, conformanceRunId: string) =>
    req<VersionOut>(`/versions/${versionId}/submit`, { method: "POST", body: { conformance_run_id: conformanceRunId } }),
  withdrawVersion: (versionId: string) => req<VersionOut>(`/versions/${versionId}/withdraw`, { method: "POST" }),
  playgroundExchange: (body: { app_id: string; sandbox_id: string; code: string; code_verifier: string; redirect_uri: string; client_secret?: string }) =>
    req<TokenOut>("/playground/exchange", { method: "POST", body }),
};
