/** Integration Marketplace client (Epic 69): catalogue, listings, installations, policy, processors. Hand-written DTOs. */
import { api } from "@/lib/api/client";

const M = "/api/v1/marketplace";
const enc = encodeURIComponent;

export type ListingKind = "connector" | "legacy_connector" | "calendar" | "app";
export type PublisherKind = "platform" | "partner" | "tenant";
export type InstallState =
  | "not_installed"
  | "installed"
  | "configured"
  | "pending_approval"
  | "reconsent_required"
  | "degraded"
  | "suspended"
  | "pending_consent";
export type InstallationStatus =
  | "pending_consent"
  | "pending_approval"
  | "active"
  | "degraded"
  | "reconsent_required"
  | "suspended"
  | "uninstalled";

export type ListingCard = {
  slug: string;
  kind: ListingKind;
  name: string;
  tagline: string;
  category: string;
  publisher_kind: PublisherKind;
  publisher_badge: string;
  logo_url: string | null;
  install_state: InstallState;
  install_allowed: boolean;
  not_allowed_reason: string | null;
  installation_id: string | null;
  manage_path: string | null;
  featured: boolean;
};

export type ListingPage = { data: ListingCard[]; total: number; page: number; page_size: number };

export type ScopeLine = { key: string; reason: string; sensitive: boolean };
export type DataFlowLine = {
  direction: "in" | "out" | string;
  entity: string;
  fields: string[];
  purpose: string;
  destination_country: string;
  personal_data: boolean;
};
export type SecretFieldSpec = { name: string; label: string; kind: string; required: boolean };

export type Listing = ListingCard & {
  description_md: string;
  screenshots: string[];
  scopes: ScopeLine[];
  data_flows: DataFlowLine[];
  egress_hosts: string[];
  supported_countries: string[];
  pricing_note: string | null;
  support_email: string | null;
  support_url: string | null;
  versions: { version_no: number; published_at: string | null; changelog: string | null }[];
  last_reviewed_at: string | null;
  connector_key: string | null;
  app_id: string | null;
  manifest_sha256: string | null;
  manifest_version: number | null;
  config_schema: JsonSchema | null;
  secret_fields: SecretFieldSpec[];
  legal_entity_scoped: boolean;
  erasure_supported: boolean;
  sync_jobs: { key: string; capability: string; direction: string; trigger: string }[];
  auth: string | null;
};

export type JsonSchema = {
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchema & { default?: unknown; enum?: unknown[] }>;
  required?: string[];
  enum?: unknown[];
};

export type SecretMeta = { name: string; has_secret: boolean; fingerprint: string | null; rotated_at: string | null };

export type Installation = {
  id: string;
  kind: "app" | "connector";
  app_id: string | null;
  connector_key: string | null;
  display_name: string;
  status: InstallationStatus;
  manifest_version: number;
  manifest_sha256: string;
  pending_manifest_version: number | null;
  granted_scopes: string[];
  sensitive_purposes: Record<string, string>;
  granted_by: string | null;
  granted_at: string | null;
  accountable_user_id: string | null;
  config: Record<string, unknown>;
  legal_entity_ids: string[];
  health_status: "unknown" | "ok" | "degraded" | "failing";
  last_error_code: string | null;
  created_at: string;
  secrets: SecretMeta[];
  suspended_reason: string | null;
  category: string | null;
  last_sync_at: string | null;
  approval_request_id: string | null;
  test: { ok: boolean; code: string | null; message: string | null } | null;
};

export type InstallIn = {
  kind: "app" | "connector";
  app_id?: string | null;
  connector_key?: string | null;
  scopes: string[];
  sensitive_purposes: Record<string, string>;
  config: Record<string, unknown>;
  secrets: Record<string, string>;
  legal_entity_ids: string[];
  accountable_user_id: string | null;
  accept_manifest_sha256: string;
};

export type ConfigureIn = {
  config?: Record<string, unknown>;
  secrets?: Record<string, string>;
  legal_entity_ids?: string[];
  accountable_user_id?: string;
  display_name?: string;
};

export type TestResult = { ok: boolean; code: string | null; message: string | null; status: InstallationStatus; health_status: string };
export type UpgradeDiff = {
  installation_id: string;
  from_version: number;
  to_version: number | null;
  manifest_sha256: string | null;
  added_scopes: string[];
  added_flows: DataFlowLine[];
  added_hosts: string[];
  requires_reconsent: boolean;
};
export type HealthLog = { checked_at: string; trigger: string; result: string; error_code: string | null; latency_ms: number | null };
export type ConnectorJob = {
  id: string;
  op: string;
  status: "queued" | "running" | "succeeded" | "failed" | "dead";
  attempts: number;
  last_error: string | null;
  created_at: string;
};
export type MarketplacePolicy = {
  publisher_kinds: PublisherKind[];
  private_apps: boolean;
  user_self_authorize: boolean;
  sensitive_approval_chain_id: string | null;
  affected_installations: Installation[];
};
export type Processor = {
  name: string;
  source: "platform" | "installed";
  publisher: string | null;
  category: string | null;
  purpose: string | null;
  countries: string[];
  installed_on: string | null;
  status: string | null;
  installation_id: string | null;
};

export type ListingFilters = { category?: string; publisher?: string; q?: string; installed?: boolean };

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const marketplaceKeys = {
  all: ["marketplace"] as const,
  listings: (f: ListingFilters) => ["marketplace", "listings", f] as const,
  listing: (slug: string) => ["marketplace", "listing", slug] as const,
  installations: (status?: string, includeUninstalled?: boolean) => ["marketplace", "installations", status ?? "", !!includeUninstalled] as const,
  installation: (id: string) => ["marketplace", "installation", id] as const,
  health: (id: string) => ["marketplace", "installation", id, "health"] as const,
  jobs: (id: string) => ["marketplace", "installation", id, "jobs"] as const,
  diff: (id: string) => ["marketplace", "installation", id, "diff"] as const,
  policy: ["marketplace", "policy"] as const,
  processors: ["marketplace", "processors"] as const,
};

export const marketplaceApi = {
  listings: (f: ListingFilters, signal?: AbortSignal) =>
    api.get<ListingPage>(`${M}/listings${qs({ ...f, page_size: 200 })}`, { signal }),
  listing: (slug: string, signal?: AbortSignal) => api.get<Listing>(`${M}/listings/${enc(slug)}`, { signal }),
  install: (body: InstallIn, idempotencyKey: string) =>
    api.post<Installation>(`${M}/installations`, body, { headers: { "Idempotency-Key": idempotencyKey } }),
  installations: (status?: string, includeUninstalled?: boolean, signal?: AbortSignal) =>
    api.get<Installation[]>(`${M}/installations${qs({ status, include_uninstalled: includeUninstalled || undefined })}`, { signal }),
  installation: (id: string, signal?: AbortSignal) => api.get<Installation>(`${M}/installations/${enc(id)}`, { signal }),
  configure: (id: string, body: ConfigureIn) => api.patch<Installation>(`${M}/installations/${enc(id)}`, body),
  test: (id: string) => api.post<TestResult>(`${M}/installations/${enc(id)}/test`, {}),
  upgrade: (id: string, sha: string) => api.post<Installation>(`${M}/installations/${enc(id)}/upgrade`, { accept_manifest_sha256: sha }),
  upgradeDiff: (id: string, signal?: AbortSignal) => api.get<UpgradeDiff>(`${M}/installations/${enc(id)}/upgrade-diff`, { signal }),
  suspend: (id: string, reason: string) => api.post<Installation>(`${M}/installations/${enc(id)}/suspend`, { reason }),
  resume: (id: string, reason: string) => api.post<Installation>(`${M}/installations/${enc(id)}/resume`, { reason }),
  uninstall: (id: string, reason: string, propagateErasure: boolean) =>
    api.post<Installation>(`${M}/installations/${enc(id)}/uninstall`, { reason, propagate_erasure: propagateErasure }),
  health: (id: string, signal?: AbortSignal) => api.get<HealthLog[]>(`${M}/installations/${enc(id)}/health`, { signal }),
  jobs: (id: string, signal?: AbortSignal) => api.get<ConnectorJob[]>(`${M}/installations/${enc(id)}/jobs`, { signal }),
  retryJob: (id: string, jobId: string) => api.post<ConnectorJob>(`${M}/installations/${enc(id)}/jobs/${enc(jobId)}/retry`, {}),
  runSync: (id: string, jobKey: string) => api.post<ConnectorJob>(`${M}/installations/${enc(id)}/sync/${enc(jobKey)}`, {}),
  preapprove: (id: string, userIds: string[], scopes: string[]) =>
    api.post<string[]>(`${M}/installations/${enc(id)}/user-authorizations`, { user_ids: userIds, scopes, resource: "api" }),
  policy: (signal?: AbortSignal) => api.get<MarketplacePolicy>(`${M}/policy`, { signal }),
  processors: (signal?: AbortSignal) => api.get<Processor[]>(`${M}/processors`, { signal }),
};
