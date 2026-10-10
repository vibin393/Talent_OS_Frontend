/**
 * Transparent CSRF retry (Epic 14, FR-82).
 *
 * A mutating call answered `403 csrf_failed` (the readable `tos_csrf` cookie expired or was cleared) asks the
 * surface's `/csrf` endpoint for a fresh token and retries **once**. A second failure throws an `ApiError`
 * with `code: "csrf_failed"` and `retried: true`; forms render it as the "reload to continue" banner
 * (`CsrfReloadBanner`) and keep their values through the reload (`useFormDraft`).
 *
 * Used by `client.ts` (internal app and Candidate Portal) and by the Client / Vendor Portal clients.
 */
import { ApiError, isApiError } from "./errors";

export const CSRF_FAILED = "csrf_failed";

/** The `/csrf` re-issue endpoint of the surface that owns `path`. */
export function csrfEndpointFor(path: string): string {
  if (path.startsWith("/api/v1/client-portal/")) return "/api/v1/client-portal/csrf";
  if (path.startsWith("/api/v1/vendor-portal/")) return "/api/v1/vendor-portal/csrf";
  if (path.startsWith("/api/v1/portal/")) return "/api/v1/portal/csrf";
  return "/api/v1/auth/csrf";
}

export function isCsrfFailure(e: unknown): e is ApiError {
  return isApiError(e) && e.status === 403 && e.code === CSRF_FAILED;
}

/** True for the final CSRF failure (after the automatic retry): show the reload banner. */
export function isCsrfExhausted(e: unknown): boolean {
  return isCsrfFailure(e) && e.retried === true;
}

/**
 * Run `run`; on `403 csrf_failed` call `refresh` (which re-issues the cookie) and run once more. A refresh
 * error or a second CSRF failure throws `ApiError{code: "csrf_failed", retried: true}`.
 */
export async function withCsrfRetry<T>(run: () => Promise<T>, refresh: () => Promise<unknown>): Promise<T> {
  try {
    return await run();
  } catch (first) {
    if (!isCsrfFailure(first)) throw first;
    try {
      await refresh();
    } catch {
      throw exhausted(first);
    }
    try {
      return await run();
    } catch (second) {
      if (isCsrfFailure(second)) throw exhausted(second);
      throw second;
    }
  }
}

function exhausted(e: ApiError): ApiError {
  const err = new ApiError(e.status, CSRF_FAILED, "Your session security token expired — reload to continue", e.details);
  err.retried = true;
  return err;
}
