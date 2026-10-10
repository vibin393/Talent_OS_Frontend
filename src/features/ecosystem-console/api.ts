/**
 * Ecosystem console client (Epic 79, FR-405 / FR-406). Reads the governance console served by
 * `router/ecosystem_console.py` at `/api/v1/ecosystem-console/*`. DTOs are hand-written (no gen:api) and mirror
 * `app/schemas/ecosystem_governance.py`. Nothing here ever carries secrets, webhook payloads or conversation text.
 */
"use client";

import { api } from "@/lib/api/client";

const V = "/api/v1/ecosystem-console";
const enc = encodeURIComponent;

// ---------------------------------------------------------------- DTOs (mirror schemas/ecosystem_governance.py)
export type ConsoleSummary = {
  active: number;
  degraded: number;
  suspended: number;
  pending_reconsents: number;
  failing_subscriptions: number;
  active_mcp_sessions: number;
  open_access_review_items: number;
  violations_7d: number;
  kill_switch_on: boolean;
};

export type InstallationKind = "app" | "connector" | "api_key";

export type InstallationRow = {
  kind: InstallationKind | string;
  id: string;
  name: string;
  publisher: string | null;
  version: string | null;
  granted_scopes: string[];
  sensitive_scopes: string[];
  status: string | null;
  health_status: string | null;
  last_activity_at: string | null;
  requests_30d: number;
  errors_30d: number;
  minutes_30d: number;
  accountable_user: string | null;
};

/** `console.authorizations` returns `app_user_authorizations` rows (loose dict on the wire). */
export type AuthorizationRow = {
  id: string;
  installation_id?: string | null;
  installation?: string | null;
  user_id?: string | null;
  user?: string | null;
  resource?: string | null;
  scopes?: string[] | null;
  granted_scopes?: string[] | null;
  authorized_at?: string | null;
  granted_at?: string | null;
  last_used_at?: string | null;
};

export type DataFlowRow = {
  installation: string;
  publisher: string | null;
  direction: "out" | "in" | string;
  entity: string;
  fields: string[];
  personal_data: boolean;
  purpose: string | null;
  destination_country: string | null;
  since: string | null;
  subjects_exposed_90d: number;
  processor_role: string | null;
  restricted_transfer: boolean;
};

export type ViolationRow = {
  kind: string;
  at: string | null;
  installation: string | null;
  user: string | null;
  route_or_tool: string | null;
  error_code: string | null;
};

export type TestResultRow = {
  listing?: string | null;
  suite?: string | null;
  result?: string | null;
  run_at?: string | null;
  [key: string]: unknown;
};

export type AccessReviewSettings = {
  cadence_months: number;
  stale_after_days: number;
  auto_revoke_stale: boolean;
  reviewer_role_key: string | null;
};

export type AccessReview = {
  id: string;
  period_start: string;
  period_end: string;
  status: "open" | "completed" | "expired" | string;
  item_count: number;
  decided_count: number;
  opened_at: string | null;
  completed_at: string | null;
};

export type AccessReviewItem = {
  id: string;
  kind: "installation_grant" | "user_authorization" | "api_key" | string;
  subject_id: string;
  snapshot: Record<string, unknown>;
  stale: boolean;
  decision: "pending" | "confirmed" | "reduced" | "revoked" | "auto_revoked" | string;
  note: string | null;
};

export type EnablementCheck = { key: string; label: string; status: "ok" | "warning" | "blocking" | string; detail: string | null };
export type FeatureReadiness = { feature: string; status: "ok" | "warning" | "blocking" | string; checks: EnablementCheck[] };

export type AccessDecision = "confirmed" | "reduced" | "revoked";

function qs(params: Record<string, string | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const consoleApi = {
  summary: (signal?: AbortSignal) => api.get<ConsoleSummary>(`${V}/summary`, { signal }),
  installations: (
    filters: { kind?: string | null; status?: string | null; q?: string | null },
    signal?: AbortSignal,
  ) => api.get<InstallationRow[]>(`${V}/installations${qs(filters)}`, { signal }),
  authorizations: (filters: { installation_id?: string | null; user_id?: string | null }, signal?: AbortSignal) =>
    api.get<AuthorizationRow[]>(`${V}/authorizations${qs(filters)}`, { signal }),
  revokeAuthorization: (id: string, reason: string) =>
    api.post<void>(`${V}/authorizations/${enc(id)}/revoke`, { reason }),
  dataFlows: (signal?: AbortSignal) => api.get<DataFlowRow[]>(`${V}/data-flows`, { signal }),
  dataFlowsCsvUrl: () => `${V}/data-flows.csv`,
  violations: (filters: { kind?: string | null }, signal?: AbortSignal) =>
    api.get<ViolationRow[]>(`${V}/violations${qs(filters)}`, { signal }),
  testResults: (signal?: AbortSignal) => api.get<TestResultRow[]>(`${V}/test-results`, { signal }),
  featureReadiness: (signal?: AbortSignal) => api.get<FeatureReadiness[]>(`${V}/feature-readiness`, { signal }),

  reviewSettings: (signal?: AbortSignal) => api.get<AccessReviewSettings>(`${V}/access-reviews/settings`, { signal }),
  setReviewSettings: (body: AccessReviewSettings) => api.put<AccessReviewSettings>(`${V}/access-reviews/settings`, body),
  reviews: (signal?: AbortSignal) => api.get<AccessReview[]>(`${V}/access-reviews`, { signal }),
  reviewItems: (reviewId: string, filters: { stale_only?: boolean; kind?: string | null }, signal?: AbortSignal) =>
    api.get<AccessReviewItem[]>(`${V}/access-reviews/${enc(reviewId)}/items${qs(filters)}`, { signal }),
  decideItem: (itemId: string, decision: AccessDecision, note: string | null) =>
    api.post<AccessReviewItem>(`${V}/access-reviews/items/${enc(itemId)}/decide`, { decision, note }),
  completeReview: (reviewId: string) => api.post<AccessReview>(`${V}/access-reviews/${enc(reviewId)}/complete`, {}),
};

export const consoleKeys = {
  all: ["ecosystem-console"] as const,
  summary: ["ecosystem-console", "summary"] as const,
  installations: (q: string) => ["ecosystem-console", "installations", q] as const,
  authorizations: (q: string) => ["ecosystem-console", "authorizations", q] as const,
  dataFlows: ["ecosystem-console", "data-flows"] as const,
  violations: (kind: string) => ["ecosystem-console", "violations", kind] as const,
  testResults: ["ecosystem-console", "test-results"] as const,
  featureReadiness: ["ecosystem-console", "feature-readiness"] as const,
  reviewSettings: ["ecosystem-console", "review-settings"] as const,
  reviews: ["ecosystem-console", "reviews"] as const,
  reviewItems: (id: string, q: string) => ["ecosystem-console", "review-items", id, q] as const,
};
