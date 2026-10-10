/**
 * The only way the browser talks to the backend.
 *
 * - Relative `/api/...` URLs only: next.config.ts proxies them to BACKEND_URL (first-party cookies).
 * - `credentials: "include"` so the httpOnly `tos_session` cookie is sent.
 * - JSON bodies are serialised; a `FormData` body is sent as multipart (file uploads).
 * - Mutations echo the readable `tos_csrf` cookie in `X-CSRF-Token` (double-submit CSRF).
 * - Non-2xx responses are parsed from the `{error: {code, message, details}}` envelope into `ApiError`.
 * - A mutating call refused with `403 csrf_failed` re-issues the CSRF cookie and retries once (`csrf-retry.ts`).
 * - A 401 triggers the global unauthorized handler (clears the cache and sends the user to /login)
 *   unless the call opts out with `skipAuthHandler` (e.g. the login form's own invalid credentials).
 */
import { csrfEndpointFor, withCsrfRetry } from "./csrf-retry";
import { ApiError, toApiError } from "./errors";

export const CSRF_COOKIE = "tos_csrf";
export const CSRF_HEADER = "X-CSRF-Token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  /** Do not invoke the global 401 handler for this call. */
  skipAuthHandler?: boolean;
  /** Extra request headers (e.g. `Idempotency-Key`). */
  headers?: Record<string, string>;
};

type UnauthorizedHandler = (error: ApiError) => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Register the global 401 handler; returns an unregister function. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return rest.join("=");
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------- Epic 66: sandbox flag (FR-339)
type SandboxListener = (sandbox: boolean) => void;
let sandboxSeen = false;
const sandboxListeners = new Set<SandboxListener>();

function noteSandboxHeader(value: string | null): void {
  const next = value === "true";
  if (next === sandboxSeen) return;
  sandboxSeen = next;
  for (const fn of sandboxListeners) fn(next);
}

/** True once a response carried `X-TalentOS-Sandbox: true` (the latest response decides). */
export function isSandboxSeen(): boolean {
  return sandboxSeen;
}

/** Subscribe to sandbox-flag changes; returns an unsubscribe function. */
export function onSandboxChange(fn: SandboxListener): () => void {
  sandboxListeners.add(fn);
  return () => {
    sandboxListeners.delete(fn);
  };
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!path.startsWith("/api/")) {
    throw new Error(`apiRequest only accepts relative /api/ paths, got "${path}"`);
  }
  const method = options.method ?? "GET";
  if (SAFE_METHODS.has(method)) return send<T>(path, options);
  // Epic 14 (FR-82): an expired CSRF token is refreshed from the surface's /csrf endpoint and retried once.
  return withCsrfRetry(
    () => send<T>(path, options),
    () => send<void>(csrfEndpointFor(path), { method: "GET", skipAuthHandler: true }),
  );
}

async function send<T>(path: string, options: RequestOptions): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { ...options.headers, Accept: "application/json" };
  // FormData (multipart uploads) is sent as-is: the browser sets the multipart boundary header.
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (!SAFE_METHODS.has(method)) {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) headers[CSRF_HEADER] = csrf;
  }

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: options.body === undefined ? undefined : isForm ? (options.body as FormData) : JSON.stringify(options.body),
      credentials: "include",
      cache: "no-store",
      signal: options.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "network_error", "Cannot reach the server");
  }

  // Epic 66 (FR-339): a Sandbox Tenant's responses carry `X-TalentOS-Sandbox: true` (shown as a persistent banner).
  noteSandboxHeader(res.headers.get("X-TalentOS-Sandbox"));

  let text = "";
  if (res.status !== 204) {
    try {
      text = await res.text();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      throw new ApiError(0, "network_error", "Cannot reach the server");
    }
  }
  let body: unknown = null;
  // A literal JSON `null` is a valid answer ("nothing yet", e.g. a client without a billing profile);
  // only an empty or unparseable body is an invalid response.
  let explicitNull = false;
  if (text) {
    try {
      body = JSON.parse(text);
      explicitNull = body === null;
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const error = toApiError(res.status, body);
    if (res.status === 401 && !options.skipAuthHandler) unauthorizedHandler?.(error);
    throw error;
  }
  if (res.status === 204) return undefined as T;
  // 202 Accepted legitimately carries no body (e.g. password-reset request).
  if (res.status === 202 && body === null) return undefined as T;
  if (explicitNull) return null as T;
  if (body === null) {
    throw new ApiError(res.status, "invalid_response", "Unexpected response from server");
  }
  return body as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "DELETE" }),
};
