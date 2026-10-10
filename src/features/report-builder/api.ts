import { api } from "@/lib/api/client";
import type {
  ExportFormat,
  ExportOut,
  Page,
  PinOut,
  ReportIn,
  ReportOut,
  ReportPatch,
  RunLogFilters,
  RunLogOut,
  RunResult,
  ScheduleIn,
  ScheduleOut,
  ScheduleUpdate,
  ShareOut,
  ShareTarget,
  SourceCatalog,
  VizSpec,
  Definition,
} from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";
const R = `${V}/reports/custom`;

function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "" && v !== false) q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export type ReportTab = "mine" | "shared" | "all";

export const reportBuilderKeys = {
  all: ["report-builder"] as const,
  sources: () => [...reportBuilderKeys.all, "sources"] as const,
  source: (key: string) => [...reportBuilderKeys.all, "source", key] as const,
  list: (tab: ReportTab, q: string, status: string, page: number) => [...reportBuilderKeys.all, "list", tab, q, status, page] as const,
  report: (id: string) => [...reportBuilderKeys.all, "report", id] as const,
  run: (id: string, version: number) => [...reportBuilderKeys.all, "run", id, version] as const,
  pins: () => [...reportBuilderKeys.all, "pins"] as const,
  schedules: (reportId?: string) => [...reportBuilderKeys.all, "schedules", reportId ?? "all"] as const,
  runs: (filters: RunLogFilters, page: number) => [...reportBuilderKeys.all, "runs", filters, page] as const,
};

export const reportBuilderApi = {
  // foundation catalogue (fields the caller may use, with a `masked` flag)
  sources: (signal?: AbortSignal) => api.get<SourceCatalog[]>(`${V}/semantic/sources`, { signal }),
  source: (key: string, signal?: AbortSignal) => api.get<SourceCatalog>(`${V}/semantic/sources/${enc(key)}`, { signal }),

  list: (tab: ReportTab, q: string, status: string, page: number, signal?: AbortSignal) =>
    api.get<Page<ReportOut>>(`${R}${query({ tab, q, status, page, page_size: 25 })}`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<ReportOut>(`${R}/${enc(id)}`, { signal }),
  create: (body: ReportIn) => api.post<ReportOut>(R, body),
  update: (id: string, body: ReportPatch) => api.patch<ReportOut>(`${R}/${enc(id)}`, body),
  archive: (id: string) => api.delete<void>(`${R}/${enc(id)}`),

  preview: (definition: Definition, viz: VizSpec) => api.post<RunResult>(`${R}/preview`, { definition, viz }),
  run: (id: string, opts: { cached?: boolean; offset?: number } = {}, signal?: AbortSignal) =>
    api.post<RunResult>(`${R}/${enc(id)}/run${query({ cached: opts.cached, offset: opts.offset })}`, undefined, { signal }),
  export: (id: string, format: ExportFormat) => api.post<ExportOut>(`${R}/${enc(id)}/export`, { format }),
  putShares: (id: string, shares: ShareTarget[]) => api.put<ShareOut[]>(`${R}/${enc(id)}/shares`, shares),

  pin: (id: string) => api.post<PinOut[]>(`${R}/${enc(id)}/pin`),
  unpin: (id: string) => api.delete<PinOut[]>(`${R}/${enc(id)}/pin`),
  pins: (signal?: AbortSignal) => api.get<PinOut[]>(`${V}/me/report-pins`, { signal }),
  orderPins: (reportIds: string[]) => api.put<PinOut[]>(`${V}/me/report-pins/order`, { report_ids: reportIds }),

  schedules: (reportId?: string, signal?: AbortSignal) =>
    api.get<ScheduleOut[]>(`${V}/report-schedules${query({ report_id: reportId })}`, { signal }),
  createSchedule: (body: ScheduleIn) => api.post<ScheduleOut>(`${V}/report-schedules`, body),
  updateSchedule: (id: string, body: ScheduleUpdate) => api.patch<ScheduleOut>(`${V}/report-schedules/${enc(id)}`, body),
  deleteSchedule: (id: string) => api.delete<void>(`${V}/report-schedules/${enc(id)}`),
  resumeSchedule: (id: string) => api.post<ScheduleOut>(`${V}/report-schedules/${enc(id)}/resume`),

  runs: (filters: RunLogFilters, page: number, signal?: AbortSignal) =>
    api.get<Page<RunLogOut>>(`${R}/runs${query({ ...filters, page, page_size: 50 })}`, { signal }),
};

/** Absolute download URL of a run file (`/api/v1/report-runs/{id}/download`). */
export function runDownloadUrl(runId: string): string {
  return `${V}/report-runs/${enc(runId)}/download`;
}
