/**
 * Epic 59 Scheduling Agent clients: the internal app (`lib/api/client`), the Candidate Portal (`portalRequest`,
 * candidate cookie + CSRF) and the public secure-link page `slot_pick` (no cookies, like `public-links/api`).
 */
import { api } from "@/lib/api/client";
import { ApiError, toApiError } from "@/lib/api/errors";
import { portalRequest } from "@/lib/api/portal-client";
import type {
  CounterWindowIn,
  PickResultOut,
  RequestDetailOut,
  RequestOptionsOut,
  RequestOut,
  RequestStartIn,
  SchedulingPrefsIn,
  SchedulingPrefsOut,
  SchedulingSettingsIn,
  SchedulingSettingsOut,
  SlotPickView,
} from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export const schedulingApi = {
  options: (applicationId: string, stageId: string, signal?: AbortSignal) =>
    api.get<RequestOptionsOut>(`${V}/applications/${enc(applicationId)}/scheduling-options?stage_id=${enc(stageId)}`, { signal }),
  start: (applicationId: string, body: RequestStartIn, idempotencyKey: string) =>
    api.post<RequestDetailOut>(`${V}/applications/${enc(applicationId)}/scheduling-requests`, body, {
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  forApplication: (applicationId: string, signal?: AbortSignal) =>
    api.get<RequestOut[]>(`${V}/applications/${enc(applicationId)}/scheduling-requests`, { signal }),
  forInterview: (interviewId: string, signal?: AbortSignal) =>
    api.get<RequestOut[]>(`${V}/interviews/${enc(interviewId)}/scheduling-requests`, { signal }),
  get: (requestId: string, signal?: AbortSignal) => api.get<RequestDetailOut>(`${V}/scheduling-requests/${enc(requestId)}`, { signal }),
  cancel: (requestId: string, reason?: string | null) =>
    api.post<RequestDetailOut>(`${V}/scheduling-requests/${enc(requestId)}/cancel`, reason ? { reason } : {}),
  requestReschedule: (interviewId: string, reason: string) =>
    api.post<RequestOut>(`${V}/interviews/${enc(interviewId)}/reschedule-requests`, { reason }),
  myPrefs: (signal?: AbortSignal) => api.get<SchedulingPrefsOut>(`${V}/me/scheduling-preferences`, { signal }),
  saveMyPrefs: (body: SchedulingPrefsIn) => api.put<SchedulingPrefsOut>(`${V}/me/scheduling-preferences`, body),
  settings: (signal?: AbortSignal) => api.get<SchedulingSettingsOut>(`${V}/settings/agents/scheduling`, { signal }),
  updateSettings: (body: SchedulingSettingsIn) => api.put<SchedulingSettingsOut>(`${V}/settings/agents/scheduling`, body),
};

export const schedulingKeys = {
  all: ["scheduling-agent"] as const,
  options: (applicationId: string, stageId: string) => ["scheduling-agent", "options", applicationId, stageId] as const,
  forApplication: (applicationId: string) => ["scheduling-agent", "application", applicationId] as const,
  forInterview: (interviewId: string) => ["scheduling-agent", "interview", interviewId] as const,
  request: (id: string) => ["scheduling-agent", "request", id] as const,
  myPrefs: ["scheduling-agent", "my-prefs"] as const,
  settings: ["scheduling-agent", "settings"] as const,
  portal: ["portal", "scheduling"] as const,
  publicPick: (token: string) => ["public-slot-pick", token] as const,
};

/** One candidate-facing transport (portal session or secure link); the slot picker is agnostic of it. */
export interface SlotPickSource {
  key: readonly unknown[];
  get: (signal?: AbortSignal) => Promise<SlotPickView>;
  pick: (index: number, pickId: string) => Promise<PickResultOut>;
  counter: (windows: CounterWindowIn[], note: string | null) => Promise<SlotPickView>;
  timezone?: (tz: string) => Promise<SlotPickView>;
}

// ---------------------------------------------------------------- Candidate Portal
const P = `${V}/portal/scheduling`;

export const portalSchedulingApi = {
  list: (signal?: AbortSignal) => portalRequest<SlotPickView[]>(P, { signal }),
  requestReschedule: (interviewId: string, reason: string) =>
    portalRequest<{ status: string }>(`${V}/portal/interviews/${enc(interviewId)}/reschedule-request`, { method: "POST", body: { reason } }),
  source: (offer: SlotPickView): SlotPickSource => ({
    key: [...schedulingKeys.portal, offer.offer_id],
    get: async () => offer, // NOSONAR
    pick: (index, pickId) => portalRequest<PickResultOut>(`${P}/${enc(offer.offer_id ?? "")}/pick`, { method: "POST", body: { index, pick_id: pickId } }),
    counter: (windows, note) => portalRequest<SlotPickView>(`${P}/${enc(offer.offer_id ?? "")}/counter`, { method: "POST", body: { windows, note } }),
  }),
};

// ---------------------------------------------------------------- public secure link (`slot_pick`)
async function publicRequest<T>(path: string, method: "GET" | "POST", body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
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

export const publicSlotPickApi = {
  source: (token: string): SlotPickSource => {
    const base = `${V}/public/slot-pick/${enc(token)}`;
    return {
      key: schedulingKeys.publicPick(token),
      get: (signal) => publicRequest<SlotPickView>(base, "GET", undefined, signal),
      pick: (index, pickId) => publicRequest<PickResultOut>(`${base}/pick`, "POST", { index, pick_id: pickId }),
      counter: (windows, note) => publicRequest<SlotPickView>(`${base}/counter`, "POST", { windows, note }),
      timezone: (tz) => publicRequest<SlotPickView>(`${base}/timezone`, "POST", { tz }),
    };
  },
};
