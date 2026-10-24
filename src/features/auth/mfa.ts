/** Pure helpers for the MFA screens (story 1.4 API, story 1.8 UI). */
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { AuthOut, MfaRequiredOut } from "@/lib/api/types";

export const TOTP_LENGTH = 6;

/** Whether a sign-in response is the MFA challenge (`{mfa_required: true}`) rather than a session. */
export function isMfaChallenge(result: AuthOut | MfaRequiredOut | null | undefined): result is MfaRequiredOut {
  return !!result && (result as MfaRequiredOut).mfa_required === true && !("user" in result);
}

/** Digits only, at most 6 (pasting "123 456" or "123-456" works). */
export function normalizeTotpInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, TOTP_LENGTH);
}

export function isCompleteTotp(value: string): boolean {
  return new RegExp(`^\\d{${TOTP_LENGTH}}$`).test(value);
}

/** Recovery codes are case/space/dash-insensitive server-side; trim and upper-case for display. */
export function normalizeRecoveryCode(value: string): string {
  return value.trim().toUpperCase();
}

/** Base32 secret in groups of four for manual entry ("JBSW Y3DP EHPK 3PXP"). */
export function formatSecret(secret: string): string {
  return (secret.replace(/\s+/g, "").match(/.{1,4}/g) ?? []).join(" ");
}

/** Contents of the downloadable recovery-codes file. */
export function recoveryCodesText(
  codes: readonly string[],
  info: { workspace?: string; email?: string; generatedAt?: Date } = {},
): string {
  const lines = ["Talent OS recovery codes", ""];
  if (info.workspace) lines.push(`Workspace: ${info.workspace}`);
  if (info.email) lines.push(`Account: ${info.email}`);
  lines.push(`Generated: ${(info.generatedAt ?? new Date()).toISOString()}`);
  lines.push("");
  lines.push("Each code can be used once to sign in when you cannot use your authenticator app.");
  lines.push("Generating new codes invalidates these. Keep them somewhere safe.");
  lines.push("");
  for (const [i, code] of codes.entries()) lines.push(`${String(i + 1).padStart(2, " ")}. ${code}`);
  return `${lines.join("\n")}\n`;
}

/** File name for the recovery codes download ("talent-os-recovery-codes-acme.txt"). */
export function recoveryCodesFileName(workspace?: string): string {
  const slug = (workspace ?? "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""); // NOSONAR
  return slug ? `talent-os-recovery-codes-${slug}.txt` : "talent-os-recovery-codes.txt";
}

const MFA_MESSAGES: Record<string, string> = {
  invalid_code: "That code didn't work. Check your authenticator app and try again.",
  mfa_challenge_expired: "Your sign-in attempt expired or had too many wrong codes. Sign in again.",
  mfa_already_enabled: "Multi-factor authentication is already turned on for your account.",
  mfa_enrollment_not_started: "Setup was interrupted. Start again to get a new QR code.",
  mfa_not_enabled: "Multi-factor authentication is not turned on for your account.",
  mfa_required_by_tenant: "Your organization requires multi-factor authentication, so it cannot be turned off.",
  mfa_enrollment_required: "Set up multi-factor authentication to continue.",
};

/** Message for an MFA call failure; the recovery-code variant of `invalid_code` is worded separately. */
export function mfaErrorMessage(error: unknown, opts: { recoveryCode?: boolean } = {}): string {
  if (isApiError(error)) {
    if (error.code === "invalid_code" && opts.recoveryCode) {
      return "That recovery code didn't work. It may have been used already.";
    }
    const known = MFA_MESSAGES[error.code];
    if (known) return known;
    if (error.status === 422) return "Enter the 6-digit code from your authenticator app.";
    if (error.status === 429) return "Too many attempts. Please wait a moment and try again.";
  }
  return errorMessage(error);
}

/** Whether a verify failure means the challenge is gone and the password step must be repeated. */
export function isChallengeExpired(error: unknown): boolean {
  return isApiError(error) && error.code === "mfa_challenge_expired";
}
