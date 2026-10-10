import { errorMessage, isApiError } from "@/lib/api/errors";

export function formatLockedUntil(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function loginErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 401) {
      if (error.code === "account_locked" || error.details.locked_until) {
        const until = formatLockedUntil(error.details.locked_until);
        return until
          ? `Too many failed attempts. Your account is locked until ${until}.`
          : "Too many failed attempts. Your account is temporarily locked.";
      }
      if (error.code === "mfa_required") {
        // Legacy code: sign-in now answers 200 {mfa_required: true} and continues with the code step.
        return "This account requires multi-factor authentication. Sign in again to enter your code.";
      }
      return "Incorrect workspace, email or password";
    }
    if (error.status === 429) return "Too many sign-in attempts. Please wait a moment and try again.";
  }
  return errorMessage(error);
}
