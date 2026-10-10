/**
 * Server-only fetcher for the public Career Portal API (Epic 9, B1). Used by the server components under
 * `src/app/careers/**`; never import it from a client component.
 *
 * - Calls the backend directly at `INTERNAL_API_URL` (falls back to `BACKEND_URL`, as next.config.ts).
 * - Sends no cookies or credentials: these endpoints are public and cacheable.
 * - Responses are cached by Next for 60 s and tagged `careers:<slug>` (`revalidateTag` refreshes a
 *   tenant), which together with the API's own `max-age=60` keeps branding changes visible within minutes.
 */
import { ApiError, toApiError } from "./errors";
import type { PublicBranding, PublicPosting, PublicPostingPage, PublicApplyForm, PublicSitemapEntry } from "./types";

const REVALIDATE_SECONDS = 60;

function apiBase(): string {
  return (process.env.INTERNAL_API_URL ?? process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
}

export function careersTag(slug: string): string {
  return `careers:${slug}`;
}

async function publicGet<T>(slug: string, path: string): Promise<T> {
  const url = `${apiBase()}/api/v1/public/careers/${encodeURIComponent(slug)}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      credentials: "omit",
      next: { revalidate: REVALIDATE_SECONDS, tags: [careersTag(slug)] },
    });
  } catch {
    throw new ApiError(0, "network_error", "Cannot reach the server");
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) throw toApiError(res.status, body);
  if (body === null) throw new ApiError(res.status, "invalid_response", "Unexpected response from server");
  return body as T;
}

/** True for the API's 404s (unknown/disabled career site, unknown/unpublished posting). */
export function isNotFound(e: unknown): boolean {
  return e instanceof ApiError && e.status === 404;
}

export type PostingFilters = {
  q?: string;
  location?: string;
  work_mode?: string;
  employment_type?: string;
  page?: number;
};

export const PAGE_SIZE = 20;

export function postingsQuery(filters: PostingFilters, pageSize = PAGE_SIZE): string {
  const params = new URLSearchParams();
  for (const key of ["q", "location", "work_mode", "employment_type"] as const) {
    const v = filters[key]?.trim();
    if (v) params.set(key, v);
  }
  params.set("page", String(filters.page && filters.page > 0 ? filters.page : 1));
  params.set("page_size", String(pageSize));
  return params.toString();
}

export const publicCareers = {
  branding: (slug: string) => publicGet<PublicBranding>(slug, ""),
  postings: (slug: string, filters: PostingFilters) =>
    publicGet<PublicPostingPage>(slug, `/postings?${postingsQuery(filters)}`),
  posting: (slug: string, id: string) => publicGet<PublicPosting>(slug, `/postings/${encodeURIComponent(id)}`),
  applyForm: (slug: string, id: string) =>
    publicGet<PublicApplyForm>(slug, `/postings/${encodeURIComponent(id)}/apply-form`),
  sitemap: (slug: string) => publicGet<PublicSitemapEntry[]>(slug, "/sitemap"),
};
