/**
 * Public secure-link calls for the interview scorecard page (no session, no CSRF, no credentials; the API
 * checks the Origin header on POSTs). The token only ever travels in the path.
 */
import { ApiError, toApiError } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import type { PublicScorecardIn, PublicScorecardView } from "./types";

export type PublicLinkView = components["schemas"]["PublicLinkView"];

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: "omit",
      cache: "no-store",
      headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) },
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
  return body as T;
}

const base = (token: string) => `/api/v1/public/links/${encodeURIComponent(token)}`;

export const publicScorecardApi = {
  view: (token: string) => call<PublicLinkView>(base(token)),
  submit: (token: string, body: PublicScorecardIn) => call<{ status: string }>(`${base(token)}/scorecard`, { method: "POST", body: JSON.stringify(body) }),
};

export type PublicScorecardState =
  | { kind: "loading" }
  | { kind: "not_started"; view: PublicScorecardView }
  | { kind: "form"; view: PublicScorecardView }
  | { kind: "submitted"; view: PublicScorecardView | null }
  | { kind: "not_found" }
  | { kind: "used" }
  | { kind: "expired" }
  | { kind: "rate_limited" }
  | { kind: "error"; message: string };

/** Page state from the link view (or the error loading / submitting it). */
export function publicScorecardState(view: PublicScorecardView | null | undefined, error: unknown, now: number = Date.now()): PublicScorecardState {
  if (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) return { kind: "not_found" };
      if (error.status === 410) return error.code === "link_used" ? { kind: "used" } : { kind: "expired" };
      if (error.status === 429) return { kind: "rate_limited" };
      if (error.code === "interview_not_started" && view) return { kind: "not_started", view };
      if (error.status === 0) return { kind: "error", message: "Cannot reach the server. Check your connection and try again." };
      return { kind: "error", message: error.status >= 500 ? "Something went wrong. Please try again." : error.message };
    }
    return { kind: "error", message: "Something went wrong. Please try again." };
  }
  if (!view) return { kind: "loading" };
  if (view.state === "submitted") return { kind: "submitted", view };
  if (view.state === "not_started" || Date.parse(view.starts_at) > now) return { kind: "not_started", view };
  return { kind: "form", view };
}
