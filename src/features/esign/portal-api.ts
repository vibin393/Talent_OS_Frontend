/** Worker-portal eSign calls (candidate session cookie via `portalRequest`) and the portal offer OTP helpers. */
import { portalRequest } from "@/lib/api/portal-client";
import type { OfferActionOut } from "@/lib/api/types";
import type { CeremonyActionOut, CeremonyOut, OtpSentOut, PortalSignature, SignIn } from "@/features/documents/types";
import type { CeremonyApi } from "./ceremony-logic";

const S = "/api/v1/portal/work/signatures";
const O = "/api/v1/portal/offers";
const enc = encodeURIComponent;

export const portalEsignApi = {
  list: (signal?: AbortSignal) => portalRequest<PortalSignature[]>(S, { signal }),
  ceremony: (signerId: string, signal?: AbortSignal) => portalRequest<CeremonyOut>(`${S}/${enc(signerId)}`, { signal }),
  viewUrl: (signerId: string) => `${S}/${enc(signerId)}/view`,
  sendOtp: (signerId: string) => portalRequest<OtpSentOut>(`${S}/${enc(signerId)}/otp`, { method: "POST" }),
  consent: (signerId: string) => portalRequest<CeremonyActionOut>(`${S}/${enc(signerId)}/consent`, { method: "POST", body: { agreed: true } }),
  sign: (signerId: string, body: SignIn) => portalRequest<CeremonyActionOut>(`${S}/${enc(signerId)}/sign`, { method: "POST", body }),
  decline: (signerId: string, reason: string | null) =>
    portalRequest<CeremonyActionOut>(`${S}/${enc(signerId)}/decline`, { method: "POST", body: { reason } }),
};

export const portalSignatureKeys = {
  list: ["portal", "work", "signatures"] as const,
};

export function portalCeremonyApi(signerId: string): CeremonyApi {
  return {
    key: `portal:${signerId}`,
    load: (signal) => portalEsignApi.ceremony(signerId, signal),
    sendOtp: () => portalEsignApi.sendOtp(signerId),
    consent: () => portalEsignApi.consent(signerId),
    sign: (body) => portalEsignApi.sign(signerId, body),
    decline: (reason) => portalEsignApi.decline(signerId, reason),
    viewUrl: portalEsignApi.viewUrl(signerId),
  };
}

/** Offer acceptance with the optional emailed code (Epic 22 offer OTP). */
export const portalOfferOtpApi = {
  status: (offerId: string, signal?: AbortSignal) => portalRequest<{ required: boolean }>(`${O}/${enc(offerId)}/otp`, { signal }),
  send: (offerId: string) => portalRequest<OtpSentOut>(`${O}/${enc(offerId)}/otp`, { method: "POST" }),
  accept: (offerId: string, body: { typed_name: string; version_no: number; agreed: boolean; otp?: string }) =>
    portalRequest<OfferActionOut>(`${O}/${enc(offerId)}/accept`, { method: "POST", body }),
};
