/** Pure helpers for the calendar connections page. */
import type { CalendarConnectionOut, CalendarProvider, ProviderOut } from "./api";

export const PROVIDER_INFO: Record<CalendarProvider, { title: string; product: string; meeting: string }> = {
  google: { title: "Google Workspace", product: "Google Calendar and Gmail", meeting: "Google Meet" },
  microsoft: { title: "Microsoft 365", product: "Outlook calendar and mail", meeting: "Microsoft Teams" },
};

export type ConnectionState =
  | { kind: "not_configured" }
  | { kind: "not_connected" }
  | { kind: "connected"; connection: CalendarConnectionOut }
  | { kind: "needs_reconnect"; connection: CalendarConnectionOut };

/** The card state of one provider from the provider list and the user's (non-revoked) connections. */
export function connectionState(
  provider: CalendarProvider,
  providers: readonly ProviderOut[] | undefined,
  connections: readonly CalendarConnectionOut[] | undefined,
): ConnectionState {
  const conn = (connections ?? []).find((c) => c.provider === provider && c.status !== "revoked");
  if (conn?.status === "active") return { kind: "connected", connection: conn };
  if (conn?.status === "needs_reconnect") return { kind: "needs_reconnect", connection: conn };
  const configured = (providers ?? []).find((p) => p.provider === provider)?.configured ?? false;
  return configured ? { kind: "not_connected" } : { kind: "not_configured" };
}

/** Whether the user has an active connection that can create Teams / Meet links. */
export function hasActiveConnection(connections: readonly CalendarConnectionOut[] | undefined): boolean {
  return (connections ?? []).some((c) => c.status === "active");
}

const ERROR_TEXT: Record<string, string> = {
  access_denied: "You cancelled the sign-in, so nothing was connected.",
  invalid_state: "The sign-in link expired or was already used. Try connecting again.",
  exchange_failed: "The provider did not accept the sign-in. Try again.",
  provider_not_configured: "This provider is not configured by your administrator.",
};

/** Toast text for the `?connected=` / `?error=` query the OAuth callback redirects to. */
export function callbackToast(params: { get(name: string): string | null }): { intent: "success" | "error"; text: string } | null {
  const connected = params.get("connected");
  if (connected === "google" || connected === "microsoft") {
    return { intent: "success", text: `Connected ${PROVIDER_INFO[connected].title}.` };
  }
  const error = params.get("error");
  if (error) return { intent: "error", text: ERROR_TEXT[error] ?? "Could not connect your account. Try again." };
  return null;
}

/** Friendly names for OAuth scopes. */
export function scopeLabel(scope: string): string {
  const s = scope.toLowerCase();
  if (s === "calendar") return "Create calendar events with meeting links and share your free/busy time";
  if (s === "mail") return "Send interview emails from your mailbox";
  if (s.includes("calendar.events") || s === "calendars.readwrite") return "Create and update calendar events";
  if (s.includes("freebusy")) return "See when you are free or busy";
  if (s.includes("gmail.send") || s === "mail.send") return "Send email as you";
  if (s === "offline_access") return "Stay connected when you are away";
  if (s === "openid" || s === "email") return "Your email address";
  return scope;
}

/** Unique, human scope list. */
export function scopeLabels(scopes: readonly string[]): string[] {
  return [...new Set(scopes.map(scopeLabel))];
}
