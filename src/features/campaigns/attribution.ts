/**
 * Campaign attribution for the career site (Epic 39): job links in marketing messages carry `?tos_ct=<token>`;
 * the token is kept from the posting page to the apply page and sent as `attribution_token` on submit.
 */
export const ATTRIBUTION_PARAM = "tos_ct";

const TOKEN = /^[A-Za-z0-9._~-]{8,512}$/;

/** The attribution token from a query string (or `URLSearchParams`), or null when missing or malformed. */
export function readAttributionToken(search: string | URLSearchParams | null | undefined): string | null {
  if (!search) return null;
  const params = typeof search === "string" ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search) : search;
  const v = params.get(ATTRIBUTION_PARAM)?.trim();
  return v && TOKEN.test(v) ? v : null;
}

/** `href` with `tos_ct` appended (or unchanged without a token). */
export function withAttribution(href: string, token: string | null | undefined): string {
  if (!token) return href;
  const hashAt = href.indexOf("#");
  const path = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const hash = hashAt >= 0 ? href.slice(hashAt) : "";
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${ATTRIBUTION_PARAM}=${encodeURIComponent(token)}${hash}`;
}

/** The current page's token (client only; null during SSR). */
export function currentAttributionToken(): string | null {
  if (typeof window === "undefined") return null;
  return readAttributionToken(window.location.search);
}

/** `{ attribution_token }` for the apply submit payload, or `{}` when the page has no token. */
export function attributionPayload(search?: string | null): { attribution_token?: string } {
  const token = search === undefined ? currentAttributionToken() : readAttributionToken(search);
  return token ? { attribution_token: token } : {};
}
