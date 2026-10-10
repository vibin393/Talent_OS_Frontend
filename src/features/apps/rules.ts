/** Pure registration rules mirrored from the backend (Epic 67, spec A3) and consent-page copy. */

export type ClientType = "confidential" | "public";

/** null when valid, else the field hint. Exact match: https, or loopback http with a port for public clients. */
export function redirectUriError(uri: string, clientType: ClientType): string | null {
  const bad = "Use https, or http://127.0.0.1 or http://localhost for desktop and command-line apps. URIs must match exactly.";
  if (!uri || uri.length > 2000 || uri !== uri.trim() || uri.includes("*") || uri.includes("#")) return bad;
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return bad;
  }
  if (!parsed.hostname || parsed.username || parsed.password) return bad;
  if (parsed.protocol === "https:") return null;
  const loopback = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (parsed.protocol === "http:" && loopback && clientType === "public" && parsed.port !== "") return null;
  return bad;
}

/** null when valid, else the hint: every requested scope needs a reason of 10-300 characters. */
export function scopeReasonError(reason: string | undefined): string | null {
  const len = (reason ?? "").trim().length;
  return len >= 10 && len <= 300 ? null : "Explain why the app needs this (10-300 characters).";
}

export const SENSITIVE_HINT = "Sensitive access is only available when the app acts for a signed-in user.";

export function consentStateMessage(state: string, appName: string): string | null {
  switch (state) {
    case "app_not_installed":
      return `${appName} isn't set up for your organisation. Ask your Integration Administrator to install it.`;
    case "needs_admin_approval":
      return "Your organisation requires an administrator to approve this app for you first.";
    case "mcp_disabled":
      return "Your organisation hasn't turned on AI assistant access.";
    case "invalid":
      return "This link isn't valid. Return to the app and try again.";
    default:
      return null;
  }
}

export function publisherBadge(kind: string, verified: boolean, tenantName: string): string {
  if (kind === "platform") return "Talent OS";
  if (kind === "partner") return verified ? "Verified partner" : "Partner";
  return `Private app — ${tenantName}`;
}

export function statusLabel(status: string): string {
  return { development: "In development", published: "Published", suspended: "Suspended", retired: "Retired" }[status] ?? status;
}
