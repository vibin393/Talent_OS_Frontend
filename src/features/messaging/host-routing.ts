/**
 * Host-based career-site routing used by `src/proxy.ts` (Epic 9 subdomains + Epic 33 FR-174 custom domains).
 * Pure functions plus a small TTL cache so the decision logic is unit-tested without Next.
 */

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;
export const PASS_THROUGH = ["/careers/", "/portal", "/l/", "/_next/", "/api/"];
export const RESOLVE_TTL_MS = 5 * 60_000;

/** `process.env`-like map; reads APP_HOST, NEXT_PUBLIC_APP_URL, FRONTEND_URL and CAREERS_ROOT_DOMAIN. */
export type HostEnv = Readonly<Record<string, string | undefined>>;

export type HostDecision =
  | { kind: "pass" }
  | { kind: "subdomain"; slug: string }
  | { kind: "custom"; host: string };

/** Lower-cased host without port or trailing dot. */
export function normalizeRequestHost(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase().split(":")[0].replace(/\.$/, "");
}

function hostOf(url: string | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    return new URL(url.trim()).hostname.toLowerCase();
  } catch {
    return normalizeRequestHost(url) || null;
  }
}

/** Hosts that serve the app itself (never rewritten). Localhost / loopback are always app hosts. */
export function appHosts(env: HostEnv): Set<string> {
  const out = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"]);
  for (const raw of (env.APP_HOST ?? "").split(",")) {
    const h = normalizeRequestHost(raw);
    if (h) out.add(h);
  }
  for (const u of [env.NEXT_PUBLIC_APP_URL, env.FRONTEND_URL]) {
    const h = hostOf(u);
    if (h) out.add(h);
  }
  return out;
}

export function careersRoot(env: HostEnv): string | null {
  const r = env.CAREERS_ROOT_DOMAIN?.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  return r || null;
}

/** What the proxy should do for `host` + `pathname`. */
export function decideHost(rawHost: string | null | undefined, pathname: string, env: HostEnv): HostDecision {
  const host = normalizeRequestHost(rawHost);
  if (!host) return { kind: "pass" };
  if (PASS_THROUGH.some((p) => pathname.startsWith(p))) return { kind: "pass" };
  if (appHosts(env).has(host) || host.endsWith(".localhost")) return { kind: "pass" };
  const root = careersRoot(env);
  if (root) {
    if (host === root || host === `www.${root}`) return { kind: "pass" };
    if (host.endsWith(`.${root}`)) {
      const slug = host.slice(0, -(root.length + 1));
      // Subdomain mode keeps its existing behaviour: an invalid label or `www` is passed through.
      if (!SLUG_RE.test(slug) || slug === "www") return { kind: "pass" };
      return { kind: "subdomain", slug };
    }
  }
  // An IP address is never a custom domain.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || !host.includes(".")) return { kind: "pass" };
  return { kind: "custom", host };
}

/** `/careers/<slug><path>` for a rewritten request. */
export function careersPath(slug: string, pathname: string): string {
  return pathname === "/" || pathname === "" ? `/careers/${slug}` : `/careers/${slug}${pathname}`;
}

/** In-memory TTL cache of host → slug (null = known not to resolve). */
export class HostCache {
  private entries = new Map<string, { slug: string | null; at: number }>();
  constructor(
    private ttlMs = RESOLVE_TTL_MS,
    private maxEntries = 1000,
  ) {}

  get(host: string, now = Date.now()): { slug: string | null } | undefined {
    const e = this.entries.get(host);
    if (!e) return undefined;
    if (now - e.at >= this.ttlMs) {
      this.entries.delete(host);
      return undefined;
    }
    return { slug: e.slug };
  }

  set(host: string, slug: string | null, now = Date.now()): void {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(host, { slug, at: now });
  }
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Slug serving `host`, via `GET /api/v1/public/careers/resolve-host` (cached for 5 min, including misses).
 * Network / 5xx failures are not cached and resolve to null (the request then falls through to the app).
 */
export async function resolveCustomHost(
  host: string,
  apiBase: string,
  cache: HostCache,
  fetcher: Fetcher = fetch,
  now = Date.now(),
): Promise<string | null> {
  const hit = cache.get(host, now);
  if (hit) return hit.slug;
  let res: Response;
  try {
    res = await fetcher(`${apiBase.replace(/\/+$/, "")}/api/v1/public/careers/resolve-host?host=${encodeURIComponent(host)}`, {
      headers: { Accept: "application/json" },
      credentials: "omit",
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (res.status === 404) {
    cache.set(host, null, now);
    return null;
  }
  if (!res.ok) return null;
  try {
    const body = (await res.json()) as { slug?: unknown };
    const slug = typeof body.slug === "string" && SLUG_RE.test(body.slug) ? body.slug : null;
    cache.set(host, slug, now);
    return slug;
  } catch {
    return null;
  }
}

export function backendBase(env: HostEnv): string {
  return (env.INTERNAL_API_URL ?? env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
}
