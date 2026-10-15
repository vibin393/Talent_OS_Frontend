import { api } from "@/lib/api/client";

/** The signed-in tenant's plan + the module keys it enables (backend `GET /entitlements/me`). */
export type EntitlementsOut = { plan: string; modules: string[] };

export const entitlementsApi = {
  me: (signal?: AbortSignal) => api.get<EntitlementsOut>("/api/v1/entitlements/me", { signal }),
};

export const entitlementKeys = {
  me: ["entitlements", "me"] as const,
};
