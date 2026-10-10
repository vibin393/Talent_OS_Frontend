import { describe, expect, it } from "vitest";
import { callbackToast, connectionState, hasActiveConnection, scopeLabels } from "./connections";
import type { CalendarConnectionOut, ProviderOut } from "./api";

const providers: ProviderOut[] = [
  { provider: "google", configured: false, scopes: [] },
  { provider: "microsoft", configured: true, scopes: ["calendar", "mail"] },
];
const conn = (status: CalendarConnectionOut["status"]): CalendarConnectionOut => ({
  id: "c1",
  provider: "microsoft",
  account_email: "me@x.test",
  scopes: [],
  status,
  connected_at: "2026-10-01T00:00:00Z",
  expires_at: null,
  last_error: null,
});

describe("calendar connections", () => {
  it("derives each provider card state", () => {
    expect(connectionState("google", providers, []).kind).toBe("not_configured");
    expect(connectionState("microsoft", providers, []).kind).toBe("not_connected");
    expect(connectionState("microsoft", providers, [conn("active")]).kind).toBe("connected");
    expect(connectionState("microsoft", providers, [conn("needs_reconnect")]).kind).toBe("needs_reconnect");
    expect(connectionState("microsoft", providers, [conn("revoked")]).kind).toBe("not_connected");
    expect(hasActiveConnection([conn("needs_reconnect")])).toBe(false);
    expect(hasActiveConnection([conn("active")])).toBe(true);
  });

  it("turns the OAuth callback query into a toast", () => {
    const q = (s: string) => new URLSearchParams(s);
    expect(callbackToast(q("connected=microsoft"))).toEqual({ intent: "success", text: "Connected Microsoft 365." });
    expect(callbackToast(q("error=invalid_state"))?.intent).toBe("error");
    expect(callbackToast(q("error=weird"))?.text).toMatch(/Could not connect/);
    expect(callbackToast(q(""))).toBeNull();
  });

  it("labels scopes", () => {
    expect(scopeLabels(["calendar", "mail"])).toHaveLength(2);
    expect(scopeLabels(["https://www.googleapis.com/auth/calendar.events", "Calendars.ReadWrite"])).toEqual(["Create and update calendar events"]);
  });
});
