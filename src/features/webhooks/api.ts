/** Webhooks client (Epic 68): subscriptions, deliveries, replay, test events and the sandbox echo endpoint. Hand-written DTOs. */
import { api } from "@/lib/api/client";

const V = "/api/v1/webhooks";

export type SubscriptionStatus = "pending_verification" | "active" | "disabled";
export type DisabledReason = "manual" | "gone" | "failing" | "egress_refused" | "uninstalled" | "scope_lost";
export type DeliveryStatus = "pending" | "in_flight" | "retrying" | "succeeded" | "failed" | "held" | "cancelled";

export type SigningSecretMeta = { fingerprint: string | null; rotated_at: string | null; previous_expires_at: string | null };

export type Subscription = {
  id: string;
  owner_kind: "tenant" | "installation";
  installation_id: string | null;
  url: string;
  url_host: string;
  description: string | null;
  event_types: string[];
  all_events: boolean;
  filters: Record<string, string[]>;
  status: SubscriptionStatus;
  disabled_reason: DisabledReason | null;
  paused: boolean;
  verified_at: string | null;
  verification_error: string | null;
  max_in_flight: number;
  suppress_own_changes: boolean;
  consecutive_failures: number;
  failure_streak_started_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  disabled_at: string | null;
  signing_secret: SigningSecretMeta;
  created_at: string;
  updated_at: string;
  version: string;
};

export type Page<T> = { data: T[]; next_cursor: string | null; has_more: boolean };

export type SubscriptionInput = {
  url: string;
  event_types: string[];
  filters: Record<string, string[]>;
  description?: string | null;
  max_in_flight: number;
  suppress_own_changes?: boolean;
  installation_id?: string | null;
};

export type SubscriptionCreated = { subscription: Subscription; signing_secret: string };
export type SecretRotated = { subscription: Subscription; signing_secret: string; previous_expires_at: string | null };

export type EventType = {
  type: string;
  version: number;
  description: string;
  scopes: string[];
  allowed: boolean;
  requires: string[];
  schema: { properties?: Record<string, unknown> };
  example: Record<string, unknown>;
};

export type Attempt = {
  n: number;
  at: string;
  status_code: number | null;
  latency_ms: number | null;
  error: string | null;
  excerpt: string | null;
};

export type Delivery = {
  id: string;
  subscription_id: string;
  event_id: string;
  event_type: string;
  kind: "event" | "replay" | "test" | "verification";
  replay_of_id: string | null;
  status: DeliveryStatus;
  attempt_count: number;
  next_attempt_at: string | null;
  last_status_code: number | null;
  last_error: string | null;
  latency_ms: number | null;
  delivered_at: string | null;
  created_at: string;
};

export type DeliveryDetail = Delivery & { attempts: Attempt[]; request_body: Record<string, unknown> | null };

export type DeliveryFilter = { status?: DeliveryStatus[]; event_type?: string; from?: string; to?: string; cursor?: string };

export type EchoEndpoint = { id: string; label: string | null; created_at: string; url?: string };
export type EchoReceipt = {
  id: string;
  received_at: string;
  event_type: string | null;
  signature_valid: boolean;
  size: number;
  headers: Record<string, string>;
  body: string;
};

function qs(params: Record<string, string | string[] | undefined>): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    for (const item of Array.isArray(v) ? v : [v]) out.append(k, item);
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

export const webhookKeys = {
  all: ["webhooks"] as const,
  list: ["webhooks", "list"] as const,
  detail: (id: string) => ["webhooks", "detail", id] as const,
  deliveries: (id: string, f: DeliveryFilter) => ["webhooks", "deliveries", id, f] as const,
  delivery: (id: string) => ["webhooks", "delivery", id] as const,
  eventTypes: (installationId?: string | null) => ["webhooks", "event-types", installationId ?? ""] as const,
  echo: ["webhooks", "echo"] as const,
  receipts: (id: string) => ["webhooks", "echo", id] as const,
};

export const webhooksApi = {
  list: (signal?: AbortSignal) => api.get<Page<Subscription>>(`${V}/subscriptions?limit=200`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<Subscription>(`${V}/subscriptions/${id}`, { signal }),
  create: (body: SubscriptionInput) => api.post<SubscriptionCreated>(`${V}/subscriptions`, body),
  update: (id: string, body: Partial<SubscriptionInput>) => api.patch<Subscription>(`${V}/subscriptions/${id}`, body),
  remove: (id: string) => api.delete<void>(`${V}/subscriptions/${id}`),
  enable: (id: string) => api.post<Subscription>(`${V}/subscriptions/${id}/enable`),
  disable: (id: string) => api.post<Subscription>(`${V}/subscriptions/${id}/disable`),
  verify: (id: string) => api.post<Subscription>(`${V}/subscriptions/${id}/verify`),
  rotate: (id: string) => api.post<SecretRotated>(`${V}/subscriptions/${id}/rotate-secret`),
  test: (id: string, eventType: string) => api.post<Delivery>(`${V}/subscriptions/${id}/test`, { event_type: eventType }),
  eventTypes: (installationId?: string | null, signal?: AbortSignal) =>
    api.get<EventType[]>(`${V}/event-types${qs({ installation_id: installationId ?? undefined })}`, { signal }),
  deliveries: (id: string, f: DeliveryFilter, signal?: AbortSignal) =>
    api.get<Page<Delivery>>(
      `${V}/subscriptions/${id}/deliveries${qs({ status: f.status, event_type: f.event_type, from: f.from, to: f.to, cursor: f.cursor })}`,
      { signal },
    ),
  delivery: (id: string, signal?: AbortSignal) => api.get<DeliveryDetail>(`${V}/deliveries/${id}`, { signal }),
  replay: (id: string) => api.post<Delivery>(`${V}/deliveries/${id}/replay`),
  replayRange: (id: string, body: { from: string; to: string; statuses: ("failed" | "held")[]; preview?: boolean }) =>
    api.post<{ count: number; started: boolean }>(`${V}/subscriptions/${id}/replay`, body),
  exportUrl: (id: string) => `${V}/deliveries/export${qs({ subscription_id: id })}`,
  echoEndpoints: (signal?: AbortSignal) => api.get<EchoEndpoint[]>(`${V}/echo-endpoints`, { signal }),
  createEcho: (label: string | null) => api.post<EchoEndpoint>(`${V}/echo-endpoints`, { label }),
  receipts: (id: string, signal?: AbortSignal) => api.get<EchoReceipt[]>(`${V}/echo-endpoints/${id}/receipts`, { signal }),
};
