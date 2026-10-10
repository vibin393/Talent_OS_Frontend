/**
 * Leave & Holidays API (Epic 26): internal `/api/v1/time/holiday-calendars|leave-*` (tenant session), Worker
 * `/api/v1/portal/work/leave-*|holidays|optional-holidays` (candidate session) and the Client Portal
 * `/api/v1/client-portal/leave-calendar` (client session).
 */
import { api } from "@/lib/api/client";
import { clientPortalRequest } from "@/lib/api/client-portal-client";
import { portalRequest } from "@/lib/api/portal-client";
import type {
  AdjustBalanceIn,
  ClientLeaveCalendarOut,
  CopyCalendarOut,
  HolidayCalendarDetail,
  HolidayCalendarIn,
  HolidayCalendarOut,
  HolidayIn,
  HolidayOut,
  LeaveBalanceOut,
  LeaveCalendarOut,
  LeaveLedgerEntryOut,
  LeaveRequestIn,
  LeaveRequestOut,
  LeaveTypeIn,
  LeaveTypeOut,
  LeaveTypeOverrideIn,
  LeaveTypeOverrideOut,
  WorkerHolidaysOut,
  WorkerLeaveBalanceOut,
  WorkerLeavePreviewOut,
  WorkerLeaveRequestOut,
  WorkerLeaveTypeOut,
} from "./types";

const enc = encodeURIComponent;
const T = "/api/v1/time";
const W = "/api/v1/portal/work";

export function qs(params: Record<string, string | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export type LeaveRequestFilters = { candidate_id?: string; client_id?: string; status?: string; from?: string; to?: string };

export const holidaysApi = {
  list: (year?: number, signal?: AbortSignal) =>
    api.get<HolidayCalendarOut[]>(`${T}/holiday-calendars${qs({ year: year ? String(year) : undefined })}`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<HolidayCalendarDetail>(`${T}/holiday-calendars/${enc(id)}`, { signal }),
  create: (body: HolidayCalendarIn) => api.post<HolidayCalendarDetail>(`${T}/holiday-calendars`, body),
  update: (id: string, body: { name?: string; optional_allowance?: number }) =>
    api.patch<HolidayCalendarDetail>(`${T}/holiday-calendars/${enc(id)}`, body),
  remove: (id: string) => api.delete<{ status: string }>(`${T}/holiday-calendars/${enc(id)}`),
  addHoliday: (id: string, body: HolidayIn) => api.post<HolidayOut>(`${T}/holiday-calendars/${enc(id)}/holidays`, body),
  removeHoliday: (holidayId: string) => api.delete<void>(`${T}/holiday-calendars/holidays/${enc(holidayId)}`),
  copy: (id: string, year: number) => api.post<CopyCalendarOut>(`${T}/holiday-calendars/${enc(id)}/copy`, { year }),
};

export const leaveApi = {
  types: (signal?: AbortSignal) => api.get<LeaveTypeOut[]>(`${T}/leave-types`, { signal }),
  createType: (body: LeaveTypeIn) => api.post<LeaveTypeOut>(`${T}/leave-types`, body),
  updateType: (id: string, body: Partial<LeaveTypeIn> & { archived?: boolean }) =>
    api.patch<LeaveTypeOut>(`${T}/leave-types/${enc(id)}`, body),
  putOverride: (id: string, clientId: string, body: LeaveTypeOverrideIn) =>
    api.put<LeaveTypeOverrideOut>(`${T}/leave-types/${enc(id)}/overrides/${enc(clientId)}`, body),
  requests: (f: LeaveRequestFilters, signal?: AbortSignal) =>
    api.get<LeaveRequestOut[]>(`${T}/leave-requests${qs(f)}`, { signal }),
  balances: (candidateId: string, signal?: AbortSignal) =>
    api.get<LeaveBalanceOut[]>(`${T}/leave-balances${qs({ candidate_id: candidateId })}`, { signal }),
  history: (candidateId: string, signal?: AbortSignal) =>
    api.get<LeaveLedgerEntryOut[]>(`${T}/leave-balances/history${qs({ candidate_id: candidateId })}`, { signal }),
  adjust: (body: AdjustBalanceIn) => api.post<LeaveBalanceOut>(`${T}/leave-balances/adjust`, body),
  calendar: (from: string, to: string, clientId?: string, signal?: AbortSignal) =>
    api.get<LeaveCalendarOut>(`${T}/leave-calendar${qs({ from, to, client_id: clientId })}`, { signal }),
};

export const workerLeaveApi = {
  types: (signal?: AbortSignal) => portalRequest<WorkerLeaveTypeOut[]>(`${W}/leave-types`, { signal }),
  balances: (signal?: AbortSignal) => portalRequest<WorkerLeaveBalanceOut[]>(`${W}/leave-balances`, { signal }),
  requests: (signal?: AbortSignal) => portalRequest<WorkerLeaveRequestOut[]>(`${W}/leave-requests`, { signal }),
  preview: (body: LeaveRequestIn, signal?: AbortSignal) =>
    portalRequest<WorkerLeavePreviewOut>(
      `${W}/leave-requests/preview${qs({
        leave_type_id: body.leave_type_id,
        start_date: body.start_date,
        end_date: body.end_date,
        start_half: body.start_half ?? undefined,
        end_half: body.end_half ?? undefined,
      })}`,
      { signal },
    ),
  create: (body: LeaveRequestIn) => portalRequest<WorkerLeaveRequestOut>(`${W}/leave-requests`, { method: "POST", body }),
  withdraw: (id: string) => portalRequest<WorkerLeaveRequestOut>(`${W}/leave-requests/${enc(id)}/withdraw`, { method: "POST" }),
  cancel: (id: string) => portalRequest<WorkerLeaveRequestOut>(`${W}/leave-requests/${enc(id)}/cancel`, { method: "POST" }),
  holidays: (year: number, signal?: AbortSignal) => portalRequest<WorkerHolidaysOut>(`${W}/holidays?year=${year}`, { signal }),
  setOptional: (holidayId: string, selected: boolean) =>
    portalRequest<WorkerHolidaysOut>(`${W}/optional-holidays`, { method: "POST", body: { holiday_id: holidayId, selected } }),
};

export const clientLeaveApi = {
  calendar: (from: string, to: string, signal?: AbortSignal) =>
    clientPortalRequest<ClientLeaveCalendarOut>(`/api/v1/client-portal/leave-calendar${qs({ from, to })}`, { signal }),
};

export const leaveKeys = {
  types: ["leave", "types"] as const,
  requests: (f: LeaveRequestFilters) => ["leave", "requests", f] as const,
  balances: (candidateId: string) => ["leave", "balances", candidateId] as const,
  history: (candidateId: string) => ["leave", "history", candidateId] as const,
  calendar: (from: string, to: string, clientId?: string) => ["leave", "calendar", from, to, clientId ?? ""] as const,
  calendars: (year?: number) => ["holidays", "calendars", year ?? 0] as const,
  calendarDetail: (id: string) => ["holidays", "calendar", id] as const,
  worker: ["work", "leave"] as const,
  workerHolidays: (year: number) => ["work", "leave", "holidays", year] as const,
  client: (from: string, to: string) => ["client-portal", "leave-calendar", from, to] as const,
};
