import { api } from "@/lib/api/client";
import type {
  InvitationAccept,
  InvitationOut,
  PasswordResetConfirm,
  PasswordResetRequest,
  UserLogin,
  AuthOut,
  MfaEnrollOut,
  MfaRequiredOut,
  MfaVerifyIn,
  RecoveryCodesOut,
  TenantSecurityOut,
} from "@/lib/api/types";

// Calls made from signed-out pages opt out of the global 401 redirect: a 401 there is a form error.
export const authApi = {
  me: (signal?: AbortSignal) => api.get<AuthOut>("/api/v1/auth/me", { signal }),
  /** Signed in (`AuthOut`), or `{mfa_required: true}` + a `tos_mfa` challenge cookie for MFA users. */
  login: (body: UserLogin) =>
    api.post<AuthOut | MfaRequiredOut>("/api/v1/auth/login", body, { skipAuthHandler: true }),
  /** Second sign-in step: exactly one of `code` (TOTP) or `recovery_code`. */
  mfaVerify: (body: MfaVerifyIn) => api.post<AuthOut>("/api/v1/auth/mfa/verify", body, { skipAuthHandler: true }),
  mfaEnroll: () => api.post<MfaEnrollOut>("/api/v1/auth/mfa/enroll"),
  mfaConfirm: (code: string) => api.post<RecoveryCodesOut>("/api/v1/auth/mfa/enroll/confirm", { code }),
  mfaDisable: (code: string) => api.post<void>("/api/v1/auth/mfa/disable", { code }),
  mfaRegenerateCodes: (code: string) =>
    api.post<RecoveryCodesOut>("/api/v1/auth/mfa/recovery-codes/regenerate", { code }),
  tenantSecurity: (signal?: AbortSignal) => api.get<TenantSecurityOut>("/api/v1/tenant/security", { signal }),
  updateTenantSecurity: (mfaRequired: boolean) =>
    api.patch<TenantSecurityOut>("/api/v1/tenant/security", { mfa_required: mfaRequired }),
  logout: () => api.post<void>("/api/v1/auth/logout", undefined, { skipAuthHandler: true }),
  // Tokens travel in request bodies, never in URLs (Epic 12).
  getInvitation: (token: string) =>
    api.post<InvitationOut>("/api/v1/auth/invitations/lookup", { token }, { skipAuthHandler: true }),
  acceptInvitation: (token: string, body: InvitationAccept) =>
    api.post<AuthOut>("/api/v1/auth/invitations/accept", { ...body, token }, { skipAuthHandler: true }),
  requestPasswordReset: (body: PasswordResetRequest) =>
    api.post<void>("/api/v1/auth/password-reset/request", body, { skipAuthHandler: true }),
  confirmPasswordReset: (body: PasswordResetConfirm) =>
    api.post<void>("/api/v1/auth/password-reset/confirm", body, { skipAuthHandler: true }),
};

export const authKeys = {
  me: ["auth", "me"] as const,
  invitation: (token: string) => ["auth", "invitation", token] as const,
  tenantSecurity: ["tenant", "security"] as const,
};
