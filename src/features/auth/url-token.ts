/**
 * Single-use tokens in emailed links travel in the URL fragment (`/reset-password#token=...`), which
 * browsers never send to servers, proxies or `Referer` headers (Epic 12, tokens out of URLs).
 */

/** The `token` parameter of a location hash such as `#token=abc` (empty string if absent). */
export function tokenFromHash(hash: string | null | undefined): string {
  const raw = (hash ?? "").replace(/^#/, "");
  if (!raw) return "";
  try {
    return (new URLSearchParams(raw).get("token") ?? "").trim();
  } catch {
    return "";
  }
}
