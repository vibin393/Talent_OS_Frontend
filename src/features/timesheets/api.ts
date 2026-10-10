/**
 * Timesheets API (Epic 25): internal `/api/v1/time/*` (tenant session), Worker `/api/v1/portal/work/timesheets`
 * (candidate session) and Client `/api/v1/client-portal/timesheets` (client session).
 */
import { api } from "@/lib/api/client";
import { clientPortalRequest } from "@/lib/api/client-portal-client";
import { portalRequest } from "@/lib/api/portal-client";
import type {
  AdjustmentIn,
  ClientBulkDecideIn,
  ClientBulkDecideOut,
  ClientBulkPreviewOut,
  ClientDecideIn,
  ClientTimeDefaultsOut,
  ClientTimesheetDetail,
  ClientTimesheetSummary,
  DayEntryIn,
  ImportApplyOut,
  ImportPreviewOut,
  MonitorFilters,
  MonitorOut,
  ProxyEntriesIn,
  ProxySubmitIn,
  RemindOut,
  TimeConfigIn,
  TimeSettingsOut,
  TimeSettingsUpdate,
  TimesheetConfigOut,
  TimesheetDetailOut,
  TimesheetSummaryOut,
  WorkerSplitPreview,
  WorkerTimesheetOut,
  WorkerTimesheetSummary,
} from "./types";

const enc = encodeURIComponent;
const T = "/api/v1/time";
const W = "/api/v1/portal/work/timesheets";
const C = "/api/v1/client-portal/timesheets";

function qs(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ---------------------------------------------------------------- internal
export type TimesheetListFilters = { placement_id?: string; status?: string; period_start?: string };

export const timeApi = {
  settings: (signal?: AbortSignal) => api.get<TimeSettingsOut>(`${T}/settings`, { signal }),
  updateSettings: (body: TimeSettingsUpdate) => api.patch<TimeSettingsOut>(`${T}/settings`, body),
  clientDefaults: (clientId: string, signal?: AbortSignal) =>
    api.get<ClientTimeDefaultsOut>(`${T}/client-defaults/${enc(clientId)}`, { signal }),
  saveClientDefaults: (clientId: string, body: TimeConfigIn) =>
    api.put<ClientTimeDefaultsOut>(`${T}/client-defaults/${enc(clientId)}`, body),
  placementConfig: (placementId: string, signal?: AbortSignal) =>
    api.get<TimesheetConfigOut>(`${T}/placements/${enc(placementId)}/config`, { signal }),
  placementConfigHistory: (placementId: string, signal?: AbortSignal) =>
    api.get<TimesheetConfigOut[]>(`${T}/placements/${enc(placementId)}/config?history=true`, { signal }),
  savePlacementConfig: (placementId: string, body: TimeConfigIn) =>
    api.put<TimesheetConfigOut>(`${T}/placements/${enc(placementId)}/config`, body),
  list: (f: TimesheetListFilters, signal?: AbortSignal) => api.get<TimesheetSummaryOut[]>(`${T}/timesheets${qs(f)}`, { signal }),
  generate: (placementId: string) => api.post<TimesheetSummaryOut[]>(`${T}/placements/${enc(placementId)}/timesheets/generate`),
  get: (id: string, signal?: AbortSignal) => api.get<TimesheetDetailOut>(`${T}/timesheets/${enc(id)}`, { signal }),
  proxyEntries: (id: string, body: ProxyEntriesIn) => api.put<TimesheetDetailOut>(`${T}/timesheets/${enc(id)}/entries`, body),
  submit: (id: string, body: ProxySubmitIn) => api.post<TimesheetDetailOut>(`${T}/timesheets/${enc(id)}/submit`, body),
  reopen: (id: string, reason: string) => api.post<TimesheetDetailOut>(`${T}/timesheets/${enc(id)}/reopen`, { reason }),
  adjust: (id: string, body: AdjustmentIn) => api.post<TimesheetDetailOut>(`${T}/timesheets/${enc(id)}/adjustments`, body),
  recordClientApproval: (id: string, file: File, clientUserId?: string, comment?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (clientUserId) form.append("client_user_id", clientUserId);
    if (comment) form.append("comment", comment);
    return api.post<TimesheetDetailOut>(`${T}/timesheets/${enc(id)}/record-client-approval`, form);
  },
  monitor: (f: MonitorFilters, signal?: AbortSignal) => api.get<MonitorOut>(`${T}/monitor${qs(f)}`, { signal }),
  remind: (timesheetIds: string[]) => api.post<RemindOut>(`${T}/monitor/remind`, { timesheet_ids: timesheetIds }),
  uploadImport: (file: File, markClientApproved: boolean) => {
    const form = new FormData();
    form.append("file", file);
    form.append("mark_client_approved", String(markClientApproved));
    return api.post<ImportPreviewOut>(`${T}/imports`, form);
  },
  importBatch: (batchId: string, signal?: AbortSignal) => api.get<ImportPreviewOut>(`${T}/imports/${enc(batchId)}`, { signal }),
  applyImport: (batchId: string, idempotencyKey: string) =>
    api.post<ImportApplyOut>(`${T}/imports/${enc(batchId)}/apply`, undefined, { headers: { "Idempotency-Key": idempotencyKey } }),
};

export const timeKeys = {
  all: ["time"] as const,
  settings: ["time", "settings"] as const,
  clientDefaults: (clientId: string) => ["time", "client-defaults", clientId] as const,
  placementConfig: (placementId: string) => ["time", "config", placementId] as const,
  placementConfigHistory: (placementId: string) => ["time", "config", placementId, "history"] as const,
  lists: ["time", "timesheets"] as const,
  list: (f: TimesheetListFilters) => ["time", "timesheets", f] as const,
  detail: (id: string) => ["time", "timesheet", id] as const,
  monitor: (f: MonitorFilters) => ["time", "monitor", f] as const,
  monitorAll: ["time", "monitor"] as const,
  importBatch: (batchId: string) => ["time", "imports", batchId] as const,
};

// ---------------------------------------------------------------- Worker portal
export const workerTimesheetsApi = {
  list: (signal?: AbortSignal) => portalRequest<WorkerTimesheetSummary[]>(W, { signal }),
  get: (id: string, signal?: AbortSignal) => portalRequest<WorkerTimesheetOut>(`${W}/${enc(id)}`, { signal }),
  saveEntries: (id: string, days: DayEntryIn[]) =>
    portalRequest<WorkerTimesheetOut>(`${W}/${enc(id)}/entries`, { method: "PUT", body: { days } }),
  copyPrevious: (id: string) => portalRequest<WorkerTimesheetOut>(`${W}/${enc(id)}/copy-previous`, { method: "POST" }),
  refreshPrefill: (id: string) => portalRequest<WorkerTimesheetOut>(`${W}/${enc(id)}/refresh-prefill`, { method: "POST" }),
  previewSplit: (id: string) => portalRequest<WorkerSplitPreview>(`${W}/${enc(id)}/preview-split`, { method: "POST" }),
  submit: (id: string, confirmZero: boolean) =>
    portalRequest<WorkerTimesheetOut>(`${W}/${enc(id)}/submit`, { method: "POST", body: { confirm_zero: confirmZero } }),
  recall: (id: string) => portalRequest<WorkerTimesheetOut>(`${W}/${enc(id)}/recall`, { method: "POST" }),
};

export const workerTimesheetKeys = {
  list: ["portal", "work", "timesheets"] as const,
  detail: (id: string) => ["portal", "work", "timesheets", id] as const,
  split: (id: string) => ["portal", "work", "timesheets", id, "split"] as const,
};

// ---------------------------------------------------------------- Client portal
export const clientTimesheetsApi = {
  list: (status: "pending" | "all", signal?: AbortSignal) =>
    clientPortalRequest<ClientTimesheetSummary[]>(`${C}?status=${status}`, { signal }),
  get: (id: string, signal?: AbortSignal) => clientPortalRequest<ClientTimesheetDetail>(`${C}/${enc(id)}`, { signal }),
  decide: (id: string, body: ClientDecideIn) =>
    clientPortalRequest<ClientTimesheetDetail>(`${C}/${enc(id)}/decide`, { method: "POST", body }),
  bulkPreview: (timesheetIds: string[]) =>
    clientPortalRequest<ClientBulkPreviewOut>(`${C}/bulk-preview`, { method: "POST", body: { timesheet_ids: timesheetIds } }),
  bulkDecide: (body: ClientBulkDecideIn, idempotencyKey: string) =>
    clientPortalRequest<ClientBulkDecideOut>(`${C}/bulk-decide`, {
      method: "POST",
      body,
      headers: { "Idempotency-Key": idempotencyKey },
    }),
};

export const clientTimesheetKeys = {
  all: ["client-portal", "timesheets"] as const,
  list: (status: "pending" | "all") => ["client-portal", "timesheets", status] as const,
  detail: (id: string) => ["client-portal", "timesheets", "detail", id] as const,
};
