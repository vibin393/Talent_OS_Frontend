/**
 * Conditional polling (Epic 43 live views): `GET` with `If-None-Match`; a `304 Not Modified` keeps the previous
 * data. Pure and fetch-injectable so it is unit-tested without a browser.
 */
import { ApiError, toApiError } from "@/lib/api/errors";

export const POLL_INTERVAL_MS = 5_000;

export type EtagResult<T> = { status: "fresh"; data: T; etag: string | null } | { status: "not_modified"; etag: string | null };

export type PollState<T> = { data: T | undefined; etag: string | null };

type FetchLike = (input: string, init?: RequestInit) => Promise<Pick<Response, "status" | "ok" | "headers" | "text">>;

/** One conditional GET of a same-origin `/api/...` path with the session cookie. */
export async function fetchWithEtag<T>(path: string, etag: string | null, fetchImpl: FetchLike = fetch, signal?: AbortSignal): Promise<EtagResult<T>> {
  if (!path.startsWith("/api/")) throw new Error(`fetchWithEtag only accepts relative /api/ paths, got "${path}"`);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (etag) headers["If-None-Match"] = etag;
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchImpl(path, { method: "GET", headers, credentials: "include", cache: "no-store", signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "network_error", "Cannot reach the server");
  }
  const tag = res.headers.get("ETag");
  if (res.status === 304) return { status: "not_modified", etag: tag ?? etag };
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) throw toApiError(res.status, body);
  if (body === null) throw new ApiError(res.status, "invalid_response", "Unexpected response from server");
  return { status: "fresh", data: body as T, etag: tag };
}

/** The next poll state: fresh data replaces the old; 304 keeps the previous data (and its ETag). */
export function applyPoll<T>(prev: PollState<T>, result: EtagResult<T>): PollState<T> {
  if (result.status === "not_modified") return { data: prev.data, etag: result.etag ?? prev.etag };
  return { data: result.data, etag: result.etag };
}

/**
 * One poll step over a mutable state holder: sends the stored ETag only when data is held (a 304 without data
 * would leave nothing to show), returns the data to render.
 */
export async function pollOnce<T>(state: PollState<T>, path: string, fetchImpl?: FetchLike, signal?: AbortSignal): Promise<PollState<T>> {
  const result = await fetchWithEtag<T>(path, state.data === undefined ? null : state.etag, fetchImpl, signal);
  return applyPoll(state, result);
}
