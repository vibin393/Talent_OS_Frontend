import { api } from "@/lib/api/client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { ApiKeyCreate, ApiKeyCreated, ApiKeyOut, ApiKeyUsageOut } from "@/lib/api/types";

const enc = encodeURIComponent;
const K = "/api/v1/api-keys";

export const apiKeysApi = {
  list: (signal?: AbortSignal) => api.get<ApiKeyOut[]>(K, { signal }),
  delegableScopes: (signal?: AbortSignal) => api.get<string[]>(`${K}/delegable-scopes`, { signal }),
  create: (body: ApiKeyCreate) => api.post<ApiKeyCreated>(K, body),
  rotate: (id: string, graceHours: number) => api.post<ApiKeyCreated>(`${K}/${enc(id)}/rotate`, { grace_hours: graceHours }),
  revoke: (id: string) => api.post<ApiKeyOut>(`${K}/${enc(id)}/revoke`),
  usage: (id: string, signal?: AbortSignal) => api.get<ApiKeyUsageOut>(`${K}/${enc(id)}/usage`, { signal }),
};

export const apiKeyKeys = {
  all: ["api-keys"] as const,
  delegable: ["api-keys", "delegable"] as const,
  usage: (id: string) => ["api-keys", "usage", id] as const,
};

const MESSAGES: Record<string, string> = {
  scope_not_held: "You can only give a key permissions you hold yourself.",
  scope_not_delegable: "One of the selected permissions can never be given to an API key.",
  api_key_not_active: "This key is no longer active.",
};

export function apiKeyErrorMessage(e: unknown): string {
  if (isApiError(e)) {
    const known = MESSAGES[e.code];
    if (known) return known;
    if (e.status === 404) return "This key no longer exists. Refresh and try again.";
  }
  return errorMessage(e);
}
