/**
 * Client for the public marketing link endpoints (`/api/v1/public/m/{token}/*`). Sends no cookies
 * (`credentials: "omit"`), no CSRF header and never triggers the login redirect.
 */
import { ApiError, toApiError } from "@/lib/api/errors";
import type { UnsubscribeOut, UnsubscribeView } from "./types";

const base = (token: string) => `/api/v1/public/m/${encodeURIComponent(token)}`;

async function request<T>(path: string, method: "GET" | "POST", body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "network_error", "Cannot reach the server");
  }
  let parsed: unknown = null;
  try {
    const text = await res.text();
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) throw toApiError(res.status, parsed);
  if (parsed === null) throw new ApiError(res.status, "invalid_response", "Unexpected response from server");
  return parsed as T;
}

export const marketingPublicApi = {
  view: (token: string, signal?: AbortSignal) => request<UnsubscribeView>(`${base(token)}/u`, "GET", undefined, signal),
  unsubscribe: (token: string, all: boolean) => request<UnsubscribeOut>(`${base(token)}/u`, "POST", { all }),
};
