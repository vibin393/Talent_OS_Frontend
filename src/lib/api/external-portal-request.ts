/**
 * Shared transport of the Client and Vendor Portals (Epic 14, AD-26).
 *
 * - Calls go through `apiRequest` (CSRF header + the one-time CSRF retry of `csrf-retry.ts`), never through
 *   the internal app's 401 handler (that would send an external user to the internal `/login`).
 * - A 401 sends the browser to the portal's sign-in page (`?next=` keeps the current path) unless `quiet401`.
 * - A 403 surfaces as an `ApiError`; views render it with `AccessDenied` (`ask: "account_manager"`).
 */
import { apiRequest, type RequestOptions } from "./client";
import { isApiError } from "./errors";

export type PortalOptions = Omit<RequestOptions, "skipAuthHandler"> & { quiet401?: boolean };

export function createPortalRequest(prefix: string, signInPath: string) {
  return async function portalRequest<T>(path: string, options: PortalOptions = {}): Promise<T> {
    if (!path.startsWith(`${prefix}/`)) throw new Error(`portal request only accepts ${prefix}/ paths, got "${path}"`);
    const { quiet401, ...rest } = options;
    try {
      return await apiRequest<T>(path, { ...rest, skipAuthHandler: true });
    } catch (e) {
      if (
        !quiet401 &&
        isApiError(e) &&
        e.status === 401 &&
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith(signInPath)
      ) {
        window.location.assign(`${signInPath}?next=${encodeURIComponent(window.location.pathname)}`);
      }
      throw e;
    }
  };
}

/** Reads `#t=<token>` from the URL fragment (never sent to servers or referrers) and clears it. */
export function takeFragmentToken(): string | null {
  if (typeof window === "undefined") return null;
  const match = /[#&]t=([^&]+)/.exec(window.location.hash);
  if (!match) return null;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return decodeURIComponent(match[1]);
}
