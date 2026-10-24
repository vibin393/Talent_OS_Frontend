/**
 * Server-only fetcher for the anonymous Job Network API (Epic 75, B1; `/api/v1/public/network`). Used by the server
 * components under `src/app/jobs/**`; never import it from a client component. Sends no cookies: public and cacheable.
 */
import { ApiError, toApiError } from "./errors";

const REVALIDATE_SECONDS = 60;

function apiBase(): string {
  return (process.env.INTERNAL_API_URL ?? process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, ""); // NOSONAR
}

export type NetworkJobSummary = {
  id: string;
  title: string;
  agency: string;
  agency_slug: string;
  client_name: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  location_hidden: boolean;
  work_mode: string | null;
  employment_type: string | null;
  pay_min: string | null;
  pay_max: string | null;
  pay_currency: string | null;
  pay_period: string | null;
  published_at: string;
};

export type NetworkJobFacets = {
  work_mode: Record<string, number>;
  employment_type: Record<string, number>;
  category: Record<string, number>;
  cities: Record<string, number>;
};

export type NetworkJobPage = {
  items: NetworkJobSummary[];
  total: number;
  page: number;
  page_size: number;
  facets: NetworkJobFacets | null;
};

export type NetworkJob = NetworkJobSummary & {
  agency_careers_url: string;
  description_html: string;
  experience_min: string | null;
  experience_max: string | null;
  skills: string[];
  category: string | null;
  apply_url: string;
  posting_url: string;
  valid_through: string | null;
  jsonld: Record<string, unknown>;
};

export type NetworkAgency = {
  display_name: string;
  public_slug: string;
  logo_url: string | null;
  about_text: string | null;
  careers_url: string;
  open_jobs: number;
  jobs: NetworkJobSummary[];
};

export type NetworkSitemapItem = { listing_id: string; lastmod: string | null };

export type JobsFilters = {
  q?: string;
  location?: string;
  work_mode?: string;
  employment_type?: string;
  experience?: string;
  pay_min?: string;
  category?: string;
  posted_within?: string;
  page?: number;
};

export const PAGE_SIZE = 20;
export const NETWORK_TAG = "network:jobs";

async function get<T>(path: string): Promise<T> {
  const url = `${apiBase()}/api/v1/public/network${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      credentials: "omit",
      next: { revalidate: REVALIDATE_SECONDS, tags: [NETWORK_TAG] },
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

export function isNotFound(e: unknown): boolean {
  return e instanceof ApiError && e.status === 404;
}

export function jobsQuery(filters: JobsFilters, pageSize = PAGE_SIZE, facets = false): string {
  const params = new URLSearchParams();
  for (const key of ["q", "location", "work_mode", "employment_type", "experience", "pay_min", "category", "posted_within"] as const) {
    const v = filters[key]?.toString().trim();
    if (v) params.set(key, v);
  }
  params.set("page", String(filters.page && filters.page > 0 ? filters.page : 1));
  params.set("page_size", String(pageSize));
  if (facets) params.set("facets", "1");
  return params.toString();
}

export const network = {
  jobs: (filters: JobsFilters) => get<NetworkJobPage>(`/jobs?${jobsQuery(filters, PAGE_SIZE, true)}`),
  job: (listingId: string) => get<NetworkJob>(`/jobs/${encodeURIComponent(listingId)}`),
  agency: (slug: string) => get<NetworkAgency>(`/agencies/${encodeURIComponent(slug)}`),
  sitemap: (page = 1) => get<NetworkSitemapItem[]>(`/sitemap?page=${page}`),
};
