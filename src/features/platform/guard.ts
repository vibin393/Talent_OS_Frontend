/** Pure route-guard logic for the `/platform` operator console. */
import { isApiError } from "@/lib/api/errors";
import type { OperatorOut } from "@/lib/api/types";

export const PLATFORM_HOME = "/platform/tenants";
export const PLATFORM_LOGIN = "/platform/login";

/** Same-origin `/platform/...` path (not the login page itself); otherwise the console home. */
export function safePlatformNext(next: string | null | undefined): string {
  if (!next || typeof next !== "string") return PLATFORM_HOME;
  if (!next.startsWith("/platform") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f\u007f]/.test(next)) {
    return PLATFORM_HOME;
  }
  try {
    const url = new URL(next, "http://same.origin");
    if (url.origin !== "http://same.origin") return PLATFORM_HOME;
    const path = url.pathname;
    if (!(path === "/platform" || path.startsWith("/platform/")) || path === PLATFORM_LOGIN || path.startsWith(`${PLATFORM_LOGIN}/`)) {
      return PLATFORM_HOME;
    }
    return `${path}${url.search}${url.hash}`;
  } catch {
    return PLATFORM_HOME;
  }
}

export function platformLoginUrl(next?: string): string {
  const safe = next ? safePlatformNext(next) : PLATFORM_HOME;
  return safe === PLATFORM_HOME ? PLATFORM_LOGIN : `${PLATFORM_LOGIN}?next=${encodeURIComponent(safe)}`;
}

export type GuardState = "loading" | "login" | "enroll" | "ready" | "error";

/**
 * What the console shell renders:
 * - `login` when `GET /platform/auth/me` is 401 (no or expired `tos_platform` session);
 * - `enroll` when the operator has no second factor (console endpoints require MFA);
 * - `ready` otherwise; `loading` while pending; `error` for anything else.
 */
export function platformGuard(input: {
  mePending: boolean;
  me: OperatorOut | undefined;
  meError: unknown;
}): GuardState {
  if (input.meError) {
    return isApiError(input.meError) && input.meError.status === 401 ? "login" : "error";
  }
  if (input.mePending || !input.me) return "loading";
  if (input.me.mfa_enabled) return "ready";
  // Operators must always have a second factor. Probing a single endpoint is not reliable: some console
  // endpoints (e.g. the tenant list) don't enforce MFA while others (tenant detail) do.
  return "enroll";
}
