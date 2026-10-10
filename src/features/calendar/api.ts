import { api } from "@/lib/api/client";
import type { components, paths } from "@/lib/api/schema";

type S = components["schemas"];
type Json<T> = T extends { content: { "application/json": infer B } } ? B : never;

export type ProviderOut = S["ProviderOut"];
export type CalendarProvider = ProviderOut["provider"];
export type CalendarConnectionOut = Json<paths["/api/v1/connections"]["get"]["responses"][200]>[number];
export type FreeBusyIn = S["FreeBusyIn"];
export type FreeBusyOut = S["FreeBusyOut"];
export type UserFreeBusyOut = S["UserFreeBusyOut"];
export type BusyBlock = UserFreeBusyOut["busy"][number];

const enc = encodeURIComponent;
const V = "/api/v1/connections";

/** Epic 7 story 7.4: the signed-in user's Google Workspace / Microsoft 365 calendar and mailbox connections. */
export const calendarApi = {
  providers: (signal?: AbortSignal) => api.get<ProviderOut[]>(`${V}/providers`, { signal }),
  connections: (signal?: AbortSignal) => api.get<CalendarConnectionOut[]>(V, { signal }),
  start: (provider: CalendarProvider) => api.post<{ authorize_url: string }>(`${V}/${enc(provider)}/start`),
  disconnect: (id: string) => api.delete<CalendarConnectionOut>(`${V}/${enc(id)}`),
  freeBusy: (body: FreeBusyIn, signal?: AbortSignal) => api.post<FreeBusyOut>(`${V}/free-busy`, body, { signal }),
};

export const calendarKeys = {
  all: ["connections"] as const,
  providers: ["connections", "providers"] as const,
  mine: ["connections", "mine"] as const,
  freeBusy: (ids: readonly string[], start: string, end: string) => ["connections", "free-busy", ids.join(","), start, end] as const,
};
