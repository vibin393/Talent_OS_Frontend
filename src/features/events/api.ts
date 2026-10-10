import { api } from "@/lib/api/client";
import { downloadApiFile } from "@/lib/api/download";
import type {
  CheckInIn,
  CheckinOut,
  EventIn,
  EventOut,
  EventPatch,
  EventStatus,
  QueueEntryOut,
  StationIn,
  StationOut,
  StationPatch,
} from "./types";

const enc = encodeURIComponent;
const E = "/api/v1/campus/events";

export const eventPaths = {
  queue: (id: string) => `${E}/${enc(id)}/queue`,
  dashboard: (id: string) => `${E}/${enc(id)}/dashboard`,
  checkins: (id: string, status?: string, q?: string) => {
    const p = new URLSearchParams({ limit: "200" });
    if (status) p.set("status", status);
    if (q?.trim()) p.set("q", q.trim());
    return `${E}/${enc(id)}/checkins?${p.toString()}`;
  },
};

export const eventsApi = {
  list: (status: EventStatus | "" | undefined, signal?: AbortSignal) =>
    api.get<EventOut[]>(`${E}${status ? `?status=${enc(status)}` : ""}`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<EventOut>(`${E}/${enc(id)}`, { signal }),
  create: (body: EventIn) => api.post<EventOut>(E, body),
  update: (id: string, body: EventPatch) => api.patch<EventOut>(`${E}/${enc(id)}`, body),
  open: (id: string) => api.post<EventOut>(`${E}/${enc(id)}/open`),
  goLive: (id: string) => api.post<EventOut>(`${E}/${enc(id)}/go-live`),
  close: (id: string) => api.post<EventOut>(`${E}/${enc(id)}/close`),
  cancel: (id: string, reason: string) => api.post<EventOut>(`${E}/${enc(id)}/cancel`, { reason }),
  downloadQr: (id: string, format: "png" | "svg" | "pdf") => downloadApiFile(`${E}/${enc(id)}/qr?format=${format}`, `event-qr.${format}`),

  stations: (id: string, signal?: AbortSignal) => api.get<StationOut[]>(`${E}/${enc(id)}/stations`, { signal }),
  addStation: (id: string, body: StationIn) => api.post<StationOut>(`${E}/${enc(id)}/stations`, body),
  updateStation: (id: string, stationId: string, body: StationPatch) =>
    api.patch<StationOut>(`${E}/${enc(id)}/stations/${enc(stationId)}`, body),

  checkIn: (id: string, body: CheckInIn) => api.post<CheckinOut>(`${E}/${enc(id)}/check-in`, body),

  /** `null` when nobody is waiting. */
  callNext: (id: string, stationId: string) => api.post<QueueEntryOut | null>(`${E}/${enc(id)}/stations/${enc(stationId)}/call-next`),
  start: (id: string, entryId: string) => api.post<QueueEntryOut>(`${E}/${enc(id)}/queue/${enc(entryId)}/start`),
  complete: (id: string, entryId: string) => api.post<QueueEntryOut>(`${E}/${enc(id)}/queue/${enc(entryId)}/complete`),
  skip: (id: string, entryId: string) => api.post<QueueEntryOut>(`${E}/${enc(id)}/queue/${enc(entryId)}/skip`),
  left: (id: string, entryId: string) => api.post<QueueEntryOut>(`${E}/${enc(id)}/queue/${enc(entryId)}/left`),
  requeue: (id: string, entryId: string) => api.post<QueueEntryOut>(`${E}/${enc(id)}/queue/${enc(entryId)}/requeue`),
};

export const eventKeys = {
  all: ["campus-events"] as const,
  list: (status: string) => ["campus-events", "list", status] as const,
  detail: (id: string) => ["campus-events", "detail", id] as const,
  stations: (id: string) => ["campus-events", "stations", id] as const,
  live: (id: string, view: "queue" | "dashboard" | "checkins") => ["campus-events", "live", id, view] as const,
};
