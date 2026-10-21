/** Tenant outbound-email (SMTP) settings client: read, save and send a test email. */
import { api } from "@/lib/api/client";
import type { MailSettings, MailSettingsIn, MailTestResult } from "./types";

const A = "/api/v1/admin";

export const mailApi = {
  get: (signal?: AbortSignal) => api.get<MailSettings>(`${A}/mail-settings`, { signal }),
  update: (body: MailSettingsIn) => api.put<MailSettings>(`${A}/mail-settings`, body),
  test: (to: string) => api.post<MailTestResult>(`${A}/mail-settings/test`, { to }),
};

export const mailKeys = {
  all: ["admin", "mail-settings"] as const,
  settings: ["admin", "mail-settings", "settings"] as const,
};
