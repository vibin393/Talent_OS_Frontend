/**
 * Cookie-less client for the public eSign / verify endpoints (secure links). Like `public-links/api`, it sends no
 * credentials and no CSRF header; POSTs are same-origin so the browser's `Origin` header satisfies the API.
 */
import { ApiError, toApiError } from "@/lib/api/errors";
import type { CeremonyActionOut, CeremonyOut, OtpSentOut, PublicVerifyOut, SignIn } from "@/features/documents/types";
import type { CeremonyApi } from "./ceremony-logic";

const link = (token: string) => `/api/v1/public/links/${encodeURIComponent(token)}`;

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

export const publicEsignApi = {
  ceremony: (token: string, signal?: AbortSignal) => request<CeremonyOut>(`${link(token)}/esign`, "GET", undefined, signal),
  viewUrl: (token: string) => `${link(token)}/esign/view`,
  sendOtp: (token: string) => request<OtpSentOut>(`${link(token)}/esign/otp`, "POST", {}),
  consent: (token: string) => request<CeremonyActionOut>(`${link(token)}/esign/consent`, "POST", { agreed: true }),
  sign: (token: string, body: SignIn) => request<CeremonyActionOut>(`${link(token)}/esign/sign`, "POST", body),
  decline: (token: string, reason: string | null) => request<CeremonyActionOut>(`${link(token)}/esign/decline`, "POST", { reason }),

  /** Offer acceptance OTP on `offer_response` links. */
  offerOtpStatus: (token: string, signal?: AbortSignal) => request<{ required: boolean }>(`${link(token)}/offer-otp`, "GET", undefined, signal),
  sendOfferOtp: (token: string) => request<OtpSentOut>(`${link(token)}/offer-otp`, "POST", {}),

  /** Public certificate check (`/verify?c=`). */
  verifyCertificate: (certificateId: string, signal?: AbortSignal) =>
    request<PublicVerifyOut>(`/api/v1/public/verify/${encodeURIComponent(certificateId)}`, "GET", undefined, signal),
};

export function publicCeremonyApi(token: string): CeremonyApi {
  return {
    key: `public:${token}`,
    load: (signal) => publicEsignApi.ceremony(token, signal),
    sendOtp: () => publicEsignApi.sendOtp(token),
    consent: () => publicEsignApi.consent(token),
    sign: (body) => publicEsignApi.sign(token, body),
    decline: (reason) => publicEsignApi.decline(token, reason),
    viewUrl: publicEsignApi.viewUrl(token),
  };
}
