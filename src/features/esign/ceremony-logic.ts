/** Signing-ceremony state machine and error copy (pure; shared by the internal, portal and secure-link channels). */
import { isApiError } from "@/lib/api/errors";
import type { CeremonyActionOut, CeremonyOut, OtpSentOut, SignIn } from "@/features/documents/types";

export type CeremonyChannel = "internal" | "portal" | "public";

/** Channel-specific calls injected into `<SignCeremony/>`. */
export type CeremonyApi = {
  /** Stable cache key for this signer on this channel. */
  key: string;
  load: (signal?: AbortSignal) => Promise<CeremonyOut>;
  sendOtp: () => Promise<OtpSentOut>;
  consent: () => Promise<CeremonyActionOut>;
  sign: (body: SignIn) => Promise<CeremonyActionOut>;
  decline: (reason: string | null) => Promise<CeremonyActionOut>;
  /** PDF URL fallback when `document_url` is missing or not a relative API path. */
  viewUrl: string;
};

/**
 * Where the signer is:
 * - `signed` / `declined`: this signer already acted
 * - `completed`: everyone signed
 * - `closed`: the request is declined by someone else, expired or cancelled
 * - `waiting`: an earlier signer still has to sign
 * - `consent`: must agree to sign electronically first
 * - `sign`: ready to type a name (and enter the code when `require_otp`)
 */
export type CeremonyStep = "signed" | "declined" | "completed" | "closed" | "waiting" | "consent" | "sign";

const CLOSED = new Set(["declined", "expired", "cancelled"]);

export function ceremonyStep(c: Pick<CeremonyOut, "status" | "signer_status" | "your_turn" | "consented">, nowMs?: number, expiresAt?: string): CeremonyStep {
  if (c.signer_status === "signed") return c.status === "completed" ? "completed" : "signed";
  if (c.signer_status === "declined") return "declined";
  if (c.status === "completed") return "completed";
  if (CLOSED.has(c.status) || c.signer_status === "void") return "closed";
  if (nowMs !== undefined && expiresAt) {
    const t = Date.parse(expiresAt);
    if (!Number.isNaN(t) && t <= nowMs) return "closed";
  }
  if (!c.your_turn) return "waiting";
  if (!c.consented) return "consent";
  return "sign";
}

/** Whether the code entry is needed before signing. */
export function needsOtp(c: Pick<CeremonyOut, "require_otp" | "otp_verified">): boolean {
  return c.require_otp && !c.otp_verified;
}

export const OTP_PATTERN = /^\d{6}$/;

/** Keep digits only, at most 6 (paste of "123 456" works). */
export function normalizeOtp(input: string): string {
  return input.replace(/\D+/g, "").slice(0, 6);
}

export type SignDraft = { agreed: boolean; typedName: string; otp: string };

/** Field errors before calling the API (empty object = ready). */
export function validateSign(draft: SignDraft, otpRequired: boolean): Partial<Record<"agreed" | "typedName" | "otp", string>> {
  const errors: Partial<Record<"agreed" | "typedName" | "otp", string>> = {};
  if (!draft.agreed) errors.agreed = "Agree to sign electronically to continue.";
  if (!draft.typedName.trim()) errors.typedName = "Type your full name to sign.";
  if (otpRequired && !OTP_PATTERN.test(draft.otp)) errors.otp = "Enter the 6-digit code from the email.";
  return errors;
}

export type CeremonyErrorField = "otp" | "typedName" | "agreed" | null;

export type CeremonyError = {
  message: string;
  /** Input the error belongs to (focus it and show the message there). */
  field: CeremonyErrorField;
  /** The request state changed: reload the ceremony. */
  reload: boolean;
  /** Nothing more can be done on this page. */
  fatal: boolean;
};

const COPY: Record<string, Omit<CeremonyError, "message"> & { message: string }> = {
  otp_invalid: { message: "That code is not right. Check the email and try again.", field: "otp", reload: false, fatal: false },
  otp_expired: { message: "That code has expired. Send a new code and try again.", field: "otp", reload: false, fatal: false },
  otp_locked: { message: "Too many wrong codes. Wait 15 minutes, then send a new code.", field: "otp", reload: false, fatal: false },
  otp_rate_limited: { message: "You asked for several codes in a short time. Wait a few minutes before asking for another.", field: "otp", reload: false, fatal: false },
  otp_required: { message: "Enter the 6-digit code from the email.", field: "otp", reload: false, fatal: false },
  name_mismatch: { message: "The name you typed does not match the signer's name. Type it exactly as shown.", field: "typedName", reload: false, fatal: false },
  consent_required: { message: "Agree to sign electronically before you sign.", field: "agreed", reload: true, fatal: false },
  not_your_turn: { message: "Someone else needs to sign first. We'll email you when it's your turn.", field: null, reload: true, fatal: false },
  already_signed: { message: "You have already signed this document.", field: null, reload: true, fatal: false },
  document_hash_mismatch: {
    message: "The document changed after it was sent, so it can't be signed. Contact the sender for a new request.",
    field: null,
    reload: false,
    fatal: true,
  },
  request_closed: { message: "This signature request is closed. It may have been completed, declined, cancelled or expired.", field: null, reload: true, fatal: true },
  link_used: { message: "This link has already been used.", field: null, reload: false, fatal: true },
  link_expired: { message: "This link has expired. Contact the sender for a new one.", field: null, reload: false, fatal: true },
  link_revoked: { message: "This link was cancelled by the sender.", field: null, reload: false, fatal: true },
};

/** User-facing copy for a ceremony call failure. */
export function ceremonyError(e: unknown): CeremonyError {
  if (isApiError(e)) {
    const known = COPY[e.code];
    if (known) return { ...known };
    if (e.status === 0) return { message: "Cannot reach the server. Check your connection and try again.", field: null, reload: false, fatal: false };
    if (e.status === 404) return { message: "This signing page was not found.", field: null, reload: false, fatal: true };
    if (e.status === 410) return { message: "This signature request is no longer available.", field: null, reload: true, fatal: true };
    if (e.status === 429) return { message: "Too many attempts. Wait a few minutes and try again.", field: null, reload: false, fatal: false };
    if (e.status < 500 && e.message) return { message: e.message, field: null, reload: false, fatal: false };
  }
  return { message: "Something went wrong. Please try again.", field: null, reload: false, fatal: false };
}

/** OTP-only copy (offer acceptance reuses it). */
export function otpErrorMessage(e: unknown): string | null {
  if (!isApiError(e) || !e.code.startsWith("otp_")) return null;
  return ceremonyError(e).message;
}

/** "Signer 2 of 3" progress text. */
export function signerProgress(c: Pick<CeremonyOut, "signers">): string {
  const total = c.signers.length;
  const signed = c.signers.filter((s) => s.status === "signed").length;
  return `${signed} of ${total} signed`;
}

/** The PDF URL to embed: a relative `/api/` URL from the server, else the channel's view URL. */
export function documentUrl(c: Pick<CeremonyOut, "document_url">, fallback: string): string {
  return c.document_url && c.document_url.startsWith("/api/") ? c.document_url : fallback;
}

/** "a***@example.com" hint sentence after a code was sent. */
export function otpSentMessage(sent: Pick<OtpSentOut, "email_hint">): string {
  return sent.email_hint ? `We sent a 6-digit code to ${sent.email_hint}.` : "We sent a 6-digit code to your email.";
}
