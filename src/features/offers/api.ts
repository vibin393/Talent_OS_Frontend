import { api, CSRF_COOKIE, CSRF_HEADER, readCookie } from "@/lib/api/client";
import { ApiError, toApiError } from "@/lib/api/errors";
import type {
  MergeFieldOut,
  OfferCreate,
  OfferDetailOut,
  OfferOut,
  OfferPage,
  OfferSettingsOut,
  OfferSettingsUpdate,
  OfferTemplateIn,
  OfferTemplateOut,
  OfferTemplateUpdate,
  OfferUpdate,
  OfferVersionOut,
} from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";

/**
 * Fetch a PDF (letter preview or stored letter) with the session cookie; POSTs echo the CSRF cookie.
 * API errors surface as `ApiError`. Redirects to `/api/v1/files/{id}/download` are followed.
 */
export async function fetchPdf(path: string, init: { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal } = {}): Promise<Blob> {
  if (!path.startsWith("/api/")) throw new Error(`fetchPdf only accepts relative /api/ paths, got "${path}"`);
  const method = init.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/pdf, application/json" };
  if (method !== "GET") {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) headers[CSRF_HEADER] = csrf;
  }
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "include",
      cache: "no-store",
      signal: init.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "network_error", "Cannot reach the server");
  }
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    throw toApiError(res.status, body);
  }
  return res.blob();
}

export type OfferListFilters = { status?: string[]; owner?: "mine" | null; page?: number; pageSize?: number };

/** Every Epic 8 internal endpoint (the candidate-facing views use `candidate-api.ts`). */
export const offersApi = {
  list: (f: OfferListFilters, signal?: AbortSignal) => {
    const p = new URLSearchParams();
    for (const s of f.status ?? []) p.append("status", s);
    if (f.owner) p.set("owner", f.owner);
    p.set("page", String(f.page ?? 1));
    p.set("page_size", String(f.pageSize ?? 50));
    return api.get<OfferPage>(`${V}/offers?${p}`, { signal });
  },
  get: (id: string, signal?: AbortSignal) => api.get<OfferDetailOut>(`${V}/offers/${enc(id)}`, { signal }),
  forApplication: (applicationId: string, signal?: AbortSignal) =>
    api.get<OfferOut[]>(`${V}/applications/${enc(applicationId)}/offers`, { signal }),
  forDemand: (demandId: string, signal?: AbortSignal) => api.get<OfferOut[]>(`${V}/demands/${enc(demandId)}/offers`, { signal }),
  create: (applicationId: string, body: OfferCreate) => api.post<OfferDetailOut>(`${V}/applications/${enc(applicationId)}/offers`, body),
  update: (id: string, body: OfferUpdate) => api.patch<OfferDetailOut>(`${V}/offers/${enc(id)}`, body),
  submit: (id: string) => api.post<OfferDetailOut>(`${V}/offers/${enc(id)}/submit`),
  release: (id: string) => api.post<OfferDetailOut>(`${V}/offers/${enc(id)}/release`),
  withdraw: (id: string, reason: string) => api.post<OfferDetailOut>(`${V}/offers/${enc(id)}/withdraw`, { reason }),
  version: (id: string, versionNo: number, signal?: AbortSignal) =>
    api.get<OfferVersionOut>(`${V}/offers/${enc(id)}/versions/${versionNo}`, { signal }),
  letterPreview: (id: string, signal?: AbortSignal) => fetchPdf(`${V}/offers/${enc(id)}/letter/preview`, { method: "POST", signal }),
  letter: (id: string, versionNo: number, signal?: AbortSignal) => fetchPdf(`${V}/offers/${enc(id)}/letter?version_no=${versionNo}`, { signal }),
  letterUrl: (id: string, versionNo?: number) => `${V}/offers/${enc(id)}/letter${versionNo ? `?version_no=${versionNo}` : ""}`,
  acceptedLetterUrl: (id: string) => `${V}/offers/${enc(id)}/accepted-letter`,

  settings: (signal?: AbortSignal) => api.get<OfferSettingsOut>(`${V}/offers/settings`, { signal }),
  updateSettings: (body: OfferSettingsUpdate) => api.patch<OfferSettingsOut>(`${V}/offers/settings`, body),
  templates: (includeArchived = false, signal?: AbortSignal) =>
    api.get<OfferTemplateOut[]>(`${V}/offer-templates${includeArchived ? "?include_archived=true" : ""}`, { signal }),
  createTemplate: (body: OfferTemplateIn) => api.post<OfferTemplateOut>(`${V}/offer-templates`, body),
  updateTemplate: (id: string, body: OfferTemplateUpdate) => api.patch<OfferTemplateOut>(`${V}/offer-templates/${enc(id)}`, body),
  archiveTemplate: (id: string) => api.post<OfferTemplateOut>(`${V}/offer-templates/${enc(id)}/archive`),
  mergeFields: (signal?: AbortSignal) => api.get<MergeFieldOut[]>(`${V}/offer-templates/merge-fields`, { signal }),
  templatePreview: (bodyMd: string, signal?: AbortSignal) =>
    fetchPdf(`${V}/offer-templates/preview`, { method: "POST", body: { body_md: bodyMd }, signal }),
};

/**
 * Query keys. `offer` / `offers` are this domain's roots; mutations also refresh the Epic 6 pipeline
 * (`pipeline`), the demand detail (`demands`) and My approvals (`approvals`).
 */
export const offerKeys = {
  all: ["offers"] as const,
  lists: ["offers", "list"] as const,
  list: (f: OfferListFilters) => ["offers", "list", f] as const,
  offer: (id: string) => ["offers", "detail", id] as const,
  application: (applicationId: string) => ["offers", "application", applicationId] as const,
  demand: (demandId: string) => ["offers", "demand", demandId] as const,
  settings: ["offers", "settings"] as const,
  templates: ["offers", "templates"] as const,
  mergeFields: ["offers", "merge-fields"] as const,
  preview: (id: string, stamp: string) => ["offers", "preview", id, stamp] as const,
};

export const OFFER_RELATED_ROOTS: readonly (readonly string[])[] = [["pipeline"], ["demands", "detail"], ["approvals"], ["interviews"]];
