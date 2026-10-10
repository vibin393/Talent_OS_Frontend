/** Epic 72 calendar sync client (hand-written DTOs). */
import { api } from "@/lib/api/client";

const V = "/api/v1/calendar-sync";
const enc = encodeURIComponent;

export type MovePolicy = "restore" | "keep_as_proposal";
export type ChannelStatus = "active" | "renewing" | "polling" | "stopped" | "failed";
export type LinkState = "in_sync" | "moved" | "deleted" | "restoring" | "conflict" | "detached";

export type CalendarSyncSettings = {
  enabled: boolean;
  move_policy: MovePolicy;
  poll_minutes: number;
  restore_limit_per_hour: number;
  org_source_enabled: boolean;
  org_source_installed: boolean;
  opted_out_count: number;
};
export type CalendarSyncSettingsIn = Partial<Omit<CalendarSyncSettings, "org_source_installed" | "opted_out_count">>;
export type MyChannel = {
  connection_id: string;
  provider: string;
  status: ChannelStatus | "none";
  last_notification_at: string | null;
  last_sync_at: string | null;
  poll_minutes: number;
};
export type MySync = { tenant_enabled: boolean; channels: MyChannel[]; org_source_enabled: boolean; free_busy_opted_out: boolean };
export type ParticipantSyncState = {
  participant_id: string | null;
  user_id: string;
  name: string;
  state: "syncing" | "polling" | "not_syncing" | "not_connected";
};
export type EventLink = {
  id: string;
  role: "organizer" | "attendee";
  participant_id: string | null;
  state: LinkState;
  seen_start: string | null;
  seen_end: string | null;
  organizer_name: string | null;
};
export type InterviewSync = { interview_id: string; move_policy: MovePolicy; participants: ParticipantSyncState[]; links: EventLink[] };
export type ChannelAdmin = {
  id: string;
  person: string;
  provider: string;
  status: ChannelStatus;
  last_notification_at: string | null;
  last_sync_at: string | null;
};

export const calendarSyncKeys = {
  settings: ["calendar-sync", "settings"] as const,
  me: ["calendar-sync", "me"] as const,
  channels: ["calendar-sync", "channels"] as const,
  interview: (id: string) => ["calendar-sync", "interview", id] as const,
};

export const calendarSyncApi = {
  settings: (signal?: AbortSignal) => api.get<CalendarSyncSettings>(`${V}/settings`, { signal }),
  saveSettings: (body: CalendarSyncSettingsIn) => api.put<CalendarSyncSettings>(`${V}/settings`, body),
  me: (signal?: AbortSignal) => api.get<MySync>(`${V}/me`, { signal }),
  resync: () => api.post<{ status: string }>(`${V}/me/resync`, {}),
  optOut: (opted_out: boolean) => api.put<MySync>(`${V}/me/free-busy-optout`, { opted_out }),
  interview: (id: string, signal?: AbortSignal) => api.get<InterviewSync>(`${V}/interviews/${enc(id)}/sync`, { signal }),
  recreate: (id: string) => api.post<{ status: string }>(`${V}/interviews/${enc(id)}/recreate-event`, {}),
  keepTime: (id: string) => api.post<{ status: string }>(`${V}/interviews/${enc(id)}/keep-talent-os-time`, {}),
  dismiss: (id: string) => api.post<{ status: string }>(`${V}/interviews/${enc(id)}/dismiss-change`, {}),
  channels: (signal?: AbortSignal) => api.get<ChannelAdmin[]>(`${V}/channels`, { signal }),
};
