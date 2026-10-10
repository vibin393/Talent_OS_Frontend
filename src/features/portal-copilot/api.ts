"use client";

/** Epic 77 portal Copilot API: one client per portal (`apiBase`), each on its own portal transport. */
import { api } from "@/lib/api/client";
import { clientPortalRequest } from "@/lib/api/client-portal-client";
import { portalRequest } from "@/lib/api/portal-client";
import { vendorPortalRequest } from "@/lib/api/vendor-portal-client";
import type {
  DraftResult,
  Page,
  PortalConversation,
  PortalConversationDetail,
  PortalCopilotSettings,
  PortalCopilotSettingsIn,
  PortalCopilotStatus,
  PortalKind,
  PortalTurn,
  PortalUsage,
} from "./types";

export const API_BASE: Record<PortalKind, string> = {
  client: "/api/v1/client-portal/copilot",
  vendor: "/api/v1/vendor-portal/copilot",
  candidate: "/api/v1/portal/copilot",
};

type Req = <T>(path: string, options?: { method?: string; body?: unknown; signal?: AbortSignal; quiet401?: boolean; headers?: Record<string, string> }) => Promise<T>;

const TRANSPORT: Record<PortalKind, Req> = {
  client: clientPortalRequest as Req,
  vendor: vendorPortalRequest as Req,
  candidate: portalRequest as Req,
};

const enc = encodeURIComponent;

function idempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const portalCopilotKeys = {
  all: (portal: PortalKind) => ["portal-copilot", portal] as const,
  status: (portal: PortalKind) => ["portal-copilot", portal, "status"] as const,
  conversations: (portal: PortalKind) => ["portal-copilot", portal, "conversations"] as const,
  conversation: (portal: PortalKind, id: string) => ["portal-copilot", portal, "conversation", id] as const,
  settings: ["portal-copilot", "settings"] as const,
  usage: ["portal-copilot", "usage"] as const,
};

export function portalCopilotApi(portal: PortalKind) {
  const B = API_BASE[portal];
  const req = TRANSPORT[portal];
  return {
    base: B,
    status: (signal?: AbortSignal) => req<PortalCopilotStatus>(`${B}/status`, { signal, quiet401: true }),
    conversations: (signal?: AbortSignal) => req<Page<PortalConversation>>(`${B}/conversations?page_size=50`, { signal }),
    create: () => req<PortalConversation>(`${B}/conversations`, { method: "POST" }),
    conversation: (id: string, signal?: AbortSignal) => req<PortalConversationDetail>(`${B}/conversations/${enc(id)}`, { signal }),
    remove: (id: string) => req<void>(`${B}/conversations/${enc(id)}`, { method: "DELETE" }),
    ask: (id: string, text: string) =>
      req<PortalTurn>(`${B}/conversations/${enc(id)}/messages`, {
        method: "POST",
        body: { text },
        headers: { "Idempotency-Key": idempotencyKey() },
      }),
    cancel: (runId: string) => req<void>(`${B}/turns/${enc(runId)}/cancel`, { method: "POST" }),
    feedback: (runId: string, rating: "up" | "down", reason?: string | null) =>
      req<void>(`${B}/turns/${enc(runId)}/feedback`, { method: "POST", body: { rating, reason: reason ?? null } }),
    confirm: (id: string, edits?: Record<string, unknown> | null) =>
      req<DraftResult>(`${B}/drafts/${enc(id)}/confirm`, { method: "POST", body: edits ? { edits } : {} }),
    discard: (id: string) => req<DraftResult>(`${B}/drafts/${enc(id)}/discard`, { method: "POST" }),
    consent: (noticeId: string) => req<PortalCopilotStatus>(`${B}/consent`, { method: "POST", body: { notice_id: noticeId } }),
  };
}

/** Internal admin (`/settings/ai/copilot` → "Portals"). */
export const portalCopilotAdminApi = {
  settings: (signal?: AbortSignal) => api.get<PortalCopilotSettings>("/api/v1/copilot/portal-admin/settings", { signal }),
  save: (body: PortalCopilotSettingsIn) => api.put<PortalCopilotSettings>("/api/v1/copilot/portal-admin/settings", body),
  usage: (signal?: AbortSignal) => api.get<PortalUsage>("/api/v1/copilot/portal-admin/usage", { signal }),
};
