export const DEFAULT_APP_PATH = "/dashboard";
export const LOGIN_PATH = "/login";

/** Routes that must never trigger the "session expired" redirect (they are reachable signed out). */
// `/careers` (public career sites) and `/portal` (candidate principal, its own sign-in) never go to the user login.
// `/l/<token>` secure-link pages (AI screening, consent, client feedback) are public (Epic 6).
const PUBLIC_PREFIXES = ["/login", "/accept-invite", "/forgot-password", "/reset-password", "/status", "/careers", "/portal", "/l"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isUnsafePath(path: string): boolean {
  // Protocol-relative ("//host"), backslash tricks and control characters
  // (e.g. "/\t/evil.com" is normalised by browsers to "//evil.com").
  return !path.startsWith("/") || path.startsWith("//") || path.includes("\\") || /[\u0000-\u001f\u007f]/.test(path);
}

/**
 * Return `next` only if it is a same-origin absolute path that is not itself a public auth page;
 * otherwise the default app path. The path is validated both before and after URL normalisation,
 * because dot segments can collapse into a protocol-relative path ("/..//evil.com" -> "//evil.com").
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || typeof next !== "string" || isUnsafePath(next)) return DEFAULT_APP_PATH;
  try {
    const url = new URL(next, "http://same.origin");
    if (url.origin !== "http://same.origin") return DEFAULT_APP_PATH;
    if (isUnsafePath(url.pathname) || isPublicPath(url.pathname)) return DEFAULT_APP_PATH;
    const result = `${url.pathname}${url.search}${url.hash}`;
    return isUnsafePath(result) ? DEFAULT_APP_PATH : result;
  } catch {
    return DEFAULT_APP_PATH;
  }
}

export function loginUrl(next?: string): string {
  if (!next || next === "/") return LOGIN_PATH;
  return `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}
