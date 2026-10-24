/** Pure helpers shared by the career site pages (server and client). */

export const WORK_MODE_LABELS: Record<string, string> = {
  onsite: "On-site",
  hybrid: "Hybrid",
  remote: "Remote",
};

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  permanent: "Full-time",
  contract: "Contract",
  contract_to_hire: "Contract to hire",
  freelance: "Freelance",
};

export function workModeLabel(v: string | null | undefined): string | null {
  return v ? (WORK_MODE_LABELS[v] ?? v) : null;
}

export function employmentTypeLabel(v: string | null | undefined): string | null {
  return v ? (EMPLOYMENT_TYPE_LABELS[v] ?? v) : null;
}

// Fixed locale + UTC so server-rendered HTML and hydration agree.
const DATE = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

export function formatPostedDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : DATE.format(d);
}

// ------------------------------------------------------------------ paths
const enc = encodeURIComponent;

export function careersPath(slug: string): string {
  return `/careers/${enc(slug)}`;
}

export function jobPath(slug: string, postingId: string, postingSlug?: string | null): string {
  const base = `${careersPath(slug)}/jobs/${enc(postingId)}`;
  return postingSlug ? `${base}/${enc(postingSlug)}` : base;
}

export function applyPath(slug: string, postingId: string): string {
  return `${careersPath(slug)}/jobs/${enc(postingId)}/apply`;
}

export function portalSignInPath(slug: string): string {
  return `/portal/sign-in?tenant=${enc(slug)}`;
}

/** Search page URL for the given filters (only non-empty values), used by pagination links. */
export function searchHref(slug: string, filters: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === "" || (k === "page" && Number(v) <= 1)) continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${careersPath(slug)}?${qs}` : careersPath(slug);
}

// ------------------------------------------------------------------ JSON-LD
/**
 * Serialize JSON-LD for an inline `<script type="application/ld+json">`. `<`, `>` and `&` are escaped as
 * `<`/`>`/`&` (still valid JSON) so posting text can never close the script element, and
 * U+2028/2029 are escaped for older parsers.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Plain-text excerpt of sanitized HTML for meta descriptions. */
export function textExcerpt(html: string | null | undefined, max = 160): string {
  if (!html) return "";
  const text = html
    .replace(/<\/?(p|div|h[1-6]|li|ul|ol|br|tr|td|blockquote|section)[^>]*>/gi, " ") // NOSONAR
    .replace(/<[^>]*>/g, "") // NOSONAR
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Absolute origin of the incoming request (honours `x-forwarded-*` from a trusted proxy). */
export function requestOrigin(headers: Headers, fallback: string): string {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host || !/^[A-Za-z0-9.:[\]-]+$/.test(host)) return fallback.replace(/\/+$/, ""); // NOSONAR
  const proto = (headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"))
    .split(",")[0]
    .trim();
  return `${proto === "http" ? "http" : "https"}://${host}`;
}
