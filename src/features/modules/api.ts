/**
 * Client for native module pages (native unification).
 *
 * Native pages for other products (Croar, Feedback IQ, Portal) fetch their data through the Talent OS
 * **module gateway** — one same-origin backend surface at `/api/v1/modules/{module}/...`. The gateway
 * authenticates the Talent OS session, swaps it for the module's own token server-side, and proxies to
 * the module's backend. So from the browser's point of view it's just the normal first-party `/api`
 * client — no module tokens, no cross-origin CORS, no iframes.
 */

import { api } from "@/lib/api/client";

export type ModuleKey = "croar" | "feedbackiq" | "portal";

const base = (module: ModuleKey, path: string) =>
  `/api/v1/modules/${module}/${path.replace(/^\//, "")}`;

export const moduleApi = {
  get: <T>(module: ModuleKey, path: string) => api.get<T>(base(module, path)),
  post: <T>(module: ModuleKey, path: string, body?: unknown) => api.post<T>(base(module, path), body),
  put: <T>(module: ModuleKey, path: string, body?: unknown) => api.put<T>(base(module, path), body),
  patch: <T>(module: ModuleKey, path: string, body?: unknown) => api.patch<T>(base(module, path), body),
  delete: <T>(module: ModuleKey, path: string) => api.delete<T>(base(module, path)),
};
