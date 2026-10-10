/**
 * Candidate-side offer calls. `publicOfferApi` uses the Epic 6 secure-link routes (no session, no CSRF, no
 * credentials; POSTs are Origin-checked by the API). `portalOfferApi` uses the Candidate Portal routes (Epic 9
 * session cookie + CSRF through the shared client) so the portal page only has to render `CandidateOfferView`.
 */
import { api } from "@/lib/api/client";
import { ApiError, toApiError } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import type { AcceptIn, CandidateOfferView, DeclineIn, OfferActionOut } from "./types";

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

const link = (token: string) => `/api/v1/public/links/${encodeURIComponent(token)}`;

export const publicOfferApi = {
  view: (token: string) => call<PublicLinkView>(link(token)),
  letterUrl: (token: string) => `${link(token)}/letter`,
  viewed: (token: string) => call<CandidateOfferView>(`${link(token)}/viewed`, { method: "POST" }),
  accept: (token: string, body: AcceptIn) => call<OfferActionOut>(`${link(token)}/accept`, { method: "POST", body: JSON.stringify(body) }),
  decline: (token: string, body: DeclineIn) => call<OfferActionOut>(`${link(token)}/decline`, { method: "POST", body: JSON.stringify(body) }),
};

const P = "/api/v1/portal/offers";
const enc = encodeURIComponent;

export const portalOfferApi = {
  list: (signal?: AbortSignal) => api.get<{ items: CandidateOfferView[] }>(P, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<CandidateOfferView>(`${P}/${enc(id)}`, { signal }),
  letterUrl: (id: string) => `${P}/${enc(id)}/letter`,
  viewed: (id: string) => api.post<CandidateOfferView>(`${P}/${enc(id)}/viewed`),
  accept: (id: string, body: AcceptIn) => api.post<OfferActionOut>(`${P}/${enc(id)}/accept`, body),
  decline: (id: string, body: DeclineIn) => api.post<OfferActionOut>(`${P}/${enc(id)}/decline`, body),
};
