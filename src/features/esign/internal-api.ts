/** Internal-user signing calls (`/api/v1/documents/signers/*`, user session cookie). */
import { apiRequest } from "@/lib/api/client";
import type { CeremonyActionOut, CeremonyOut, OtpSentOut, SignIn } from "@/features/documents/types";
import type { CeremonyApi } from "./ceremony-logic";

const B = "/api/v1/documents/signers";
const enc = encodeURIComponent;

export const internalEsignApi = {
  ceremony: (signerId: string, signal?: AbortSignal) => apiRequest<CeremonyOut>(`${B}/${enc(signerId)}`, { signal }),
  viewUrl: (signerId: string) => `${B}/${enc(signerId)}/view`,
  sendOtp: (signerId: string) => apiRequest<OtpSentOut>(`${B}/${enc(signerId)}/otp`, { method: "POST" }),
  consent: (signerId: string) => apiRequest<CeremonyActionOut>(`${B}/${enc(signerId)}/consent`, { method: "POST", body: { agreed: true } }),
  sign: (signerId: string, body: SignIn) => apiRequest<CeremonyActionOut>(`${B}/${enc(signerId)}/sign`, { method: "POST", body }),
  decline: (signerId: string, reason: string | null) =>
    apiRequest<CeremonyActionOut>(`${B}/${enc(signerId)}/decline`, { method: "POST", body: { reason } }),
};

export function internalCeremonyApi(signerId: string): CeremonyApi {
  return {
    key: `internal:${signerId}`,
    load: (signal) => internalEsignApi.ceremony(signerId, signal),
    sendOtp: () => internalEsignApi.sendOtp(signerId),
    consent: () => internalEsignApi.consent(signerId),
    sign: (body) => internalEsignApi.sign(signerId, body),
    decline: (reason) => internalEsignApi.decline(signerId, reason),
    viewUrl: internalEsignApi.viewUrl(signerId),
  };
}
