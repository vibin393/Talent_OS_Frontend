/**
 * Client for the public secure-link endpoints (`/api/v1/public/links/{token}`). Unlike `lib/api/client`
 * it sends no cookies (`credentials: "omit"`) and no CSRF header, and never triggers the login redirect.
 * POSTs are same-origin, so the browser's `Origin` header matches `FRONTEND_URL` as the API requires.
 */
import { ApiError, toApiError } from "@/lib/api/errors";
import type { FeedbackDecision, PublicActionOut, PublicLinkView } from "@/lib/api/types";

const base = (token: string) => `/api/v1/public/links/${encodeURIComponent(token)}`;

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

export const publicLinkApi = {
  view: (token: string, signal?: AbortSignal) => request<PublicLinkView>(base(token), "GET", undefined, signal),
  consent: (token: string, granted: boolean, noticeId: string | null) =>
    request<PublicActionOut>(`${base(token)}/consent`, "POST", { granted, notice_id: noticeId }),
  submit: (token: string, answers: Record<string, unknown>) =>
    request<PublicActionOut>(`${base(token)}/submit`, "POST", { answers }),
  feedback: (token: string, decision: FeedbackDecision, comment: string | null) =>
    request<PublicActionOut>(`${base(token)}/feedback`, "POST", { decision, comment }),
  /** Epic 33: stop SMS / WhatsApp messages (`channel_opt_out` links). */
  optOut: (token: string) => request<{ status: string }>(`${base(token)}/opt-out`, "POST", {}),
};
