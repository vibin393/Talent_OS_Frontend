/**
 * API client for the Candidate Portal (Epic 9, B1/B4).
 *
 * - Candidate endpoints live under `/api/v1/portal/*` and authenticate with the httpOnly `tos_candidate`
 *   cookie (a principal separate from users, AD-10); mutations echo `tos_csrf` like the tenant client
 *   (`apiRequest` does this, with credentials).
 * - Calls never trigger the internal app's 401 handler (which would send a candidate to the user `/login`).
 *   A 401 instead invokes the portal handler, which the portal shell sets to redirect to `/portal/sign-in`.
 */
import { apiRequest, type RequestOptions } from "./client";
import { isApiError } from "./errors";
import type {
  CandidateLinkRequest,
  CandidateOfferList,
  CandidateOfferView,
  OfferActionOut,
  PortalApplication,
  PortalApplicationDetail,
  PortalConsent,
  PortalConsentWithdrawOut,
  PortalDataExport,
  PortalInterview,
  PortalMe,
  PortalPrivacyRequest,
  PortalPrivacyRequestIn,
  PortalProfile,
  PortalProfileUpdate,
  PortalResume,
  PortalScreening,
  PortalScreeningDetail,
  PortalStatus,
  PortalWithdrawIn,
  PortalWithdrawReason,
  PublicStatus,
} from "./types";

const enc = encodeURIComponent;
const P = "/api/v1/portal";

type Handler = () => void;
let portalUnauthorized: Handler | null = null;

/** Register the portal's 401 handler; returns an unregister function. */
export function setPortalUnauthorizedHandler(handler: Handler): () => void {
  portalUnauthorized = handler;
  return () => {
    if (portalUnauthorized === handler) portalUnauthorized = null;
  };
}

type Options = Omit<RequestOptions, "skipAuthHandler"> & { quiet401?: boolean };

export async function portalRequest<T>(path: string, options: Options = {}): Promise<T> {
  if (!path.startsWith(`${P}/`)) throw new Error(`portalRequest only accepts ${P}/ paths, got "${path}"`);
  const { quiet401, ...rest } = options;
  try {
    return await apiRequest<T>(path, { ...rest, skipAuthHandler: true });
  } catch (e) {
    if (!quiet401 && isApiError(e) && e.status === 401) portalUnauthorized?.();
    throw e;
  }
}

const get = <T>(path: string, signal?: AbortSignal) => portalRequest<T>(path, { signal });
const post = <T>(path: string, body?: unknown) => portalRequest<T>(path, { method: "POST", body });
const patch = <T>(path: string, body?: unknown) => portalRequest<T>(path, { method: "PATCH", body });

export const portalApi = {
  // session
  me: (signal?: AbortSignal) => portalRequest<PortalMe>(`${P}/me`, { signal, quiet401: true }),
  logout: () => portalRequest<void>(`${P}/auth/logout`, { method: "POST", quiet401: true }),
  requestLink: (body: CandidateLinkRequest) =>
    apiRequest<PublicStatus>("/api/v1/public/candidate-auth/request", { method: "POST", body, skipAuthHandler: true }),
  verify: (token: string) =>
    apiRequest<PortalMe>("/api/v1/public/candidate-auth/verify", { method: "POST", body: { token }, skipAuthHandler: true }),

  // profile & resumes
  profile: (signal?: AbortSignal) => get<PortalProfile>(`${P}/profile`, signal),
  updateProfile: (body: PortalProfileUpdate) => patch<PortalProfile>(`${P}/profile`, body),
  resumes: (signal?: AbortSignal) => get<PortalResume[]>(`${P}/resumes`, signal),
  uploadResume: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return post<PortalResume>(`${P}/resumes`, form);
  },

  // applications
  applications: (signal?: AbortSignal) => get<PortalApplication[]>(`${P}/applications`, signal),
  application: (id: string, signal?: AbortSignal) => get<PortalApplicationDetail>(`${P}/applications/${enc(id)}`, signal),
  withdrawReasons: (signal?: AbortSignal) => get<PortalWithdrawReason[]>(`${P}/withdraw-reasons`, signal),
  withdraw: (id: string, body: PortalWithdrawIn) => post<PortalApplicationDetail>(`${P}/applications/${enc(id)}/withdraw`, body),

  // interviews
  interviews: (upcoming: boolean, signal?: AbortSignal) => get<PortalInterview[]>(`${P}/interviews?upcoming=${upcoming}`, signal),

  // offers (Epic 8 portal_offers router)
  offers: (signal?: AbortSignal) => get<CandidateOfferList>(`${P}/offers`, signal),
  offer: (id: string, signal?: AbortSignal) => get<CandidateOfferView>(`${P}/offers/${enc(id)}`, signal),
  offerViewed: (id: string) => post<CandidateOfferView>(`${P}/offers/${enc(id)}/viewed`),
  acceptOffer: (id: string, body: { typed_name: string; version_no: number; agreed: boolean }) =>
    post<OfferActionOut>(`${P}/offers/${enc(id)}/accept`, body),
  declineOffer: (id: string, body: { reason: string | null; version_no: number }) =>
    post<OfferActionOut>(`${P}/offers/${enc(id)}/decline`, body),

  // AI screenings
  screenings: (signal?: AbortSignal) => get<PortalScreening[]>(`${P}/ai-screenings`, signal),
  screening: (id: string, signal?: AbortSignal) => get<PortalScreeningDetail>(`${P}/ai-screenings/${enc(id)}`, signal),
  screeningConsent: (id: string, body: { granted: boolean; notice_id: string | null }) =>
    post<PortalStatus>(`${P}/ai-screenings/${enc(id)}/consent`, body),
  screeningSubmit: (id: string, answers: Record<string, unknown>) => post<PortalStatus>(`${P}/ai-screenings/${enc(id)}/submit`, { answers }),

  // privacy
  consents: (signal?: AbortSignal) => get<PortalConsent[]>(`${P}/consents`, signal),
  grantConsent: (body: { purpose: "ai_processing" | "marketing"; notice_id: string }) => post<PortalConsent>(`${P}/consents`, body),
  withdrawConsent: (id: string) => post<PortalConsentWithdrawOut>(`${P}/consents/${enc(id)}/withdraw`),
  exports: (signal?: AbortSignal) => get<PortalDataExport[]>(`${P}/data-exports`, signal),
  requestExport: () => post<PortalDataExport>(`${P}/data-exports`),
  privacyRequests: (signal?: AbortSignal) => get<PortalPrivacyRequest[]>(`${P}/privacy-requests`, signal),
  createPrivacyRequest: (body: PortalPrivacyRequestIn) => post<PortalPrivacyRequest>(`${P}/privacy-requests`, body),
};

export const portalKeys = {
  all: ["portal"] as const,
  me: ["portal", "me"] as const,
  profile: ["portal", "profile"] as const,
  resumes: ["portal", "resumes"] as const,
  applications: ["portal", "applications"] as const,
  application: (id: string) => ["portal", "applications", id] as const,
  withdrawReasons: ["portal", "withdraw-reasons"] as const,
  interviews: (upcoming: boolean) => ["portal", "interviews", upcoming] as const,
  offers: ["portal", "offers"] as const,
  offer: (id: string) => ["portal", "offers", id] as const,
  screenings: ["portal", "screenings"] as const,
  screening: (id: string) => ["portal", "screenings", id] as const,
  consents: ["portal", "consents"] as const,
  exports: ["portal", "exports"] as const,
  privacyRequests: ["portal", "privacy-requests"] as const,
};
