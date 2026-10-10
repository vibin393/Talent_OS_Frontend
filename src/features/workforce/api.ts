import { CLIENT_PORTAL_PREFIX, clientPortalRequest } from "@/lib/api/client-portal-client";
import { api } from "@/lib/api/client";
import { downloadApiFile } from "@/lib/api/download";
import type {
  ActualsOut,
  ConvertIn,
  ConvertOut,
  DiffOut,
  ForecastIn,
  ForecastPortalDetail,
  ForecastPortalOut,
  ForecastUpdate,
  GroupBy,
  LineImportOut,
  LineIn,
  LineOut,
  LineUpdate,
  PlanCopyIn,
  PlanCreate,
  PlanFilters,
  PlanOut,
  PlanUpdate,
  RevisionOut,
  SlotOut,
  WorkforceSettings,
  WorkforceSettingsPatch,
} from "./types";

const enc = encodeURIComponent;
const V = "/api/v1/workforce";

function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "" && v !== false) q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export type PlanAction = "budget" | "unbudget" | "submit" | "start-revision" | "discard-revision" | "reopen";

const plan = (id: string) => `${V}/plans/${enc(id)}`;

/** Epic 44: workforce plans, lines, import, lifecycle, revisions, slots, plan vs actual, settings. */
export const workforceApi = {
  list: (filters: PlanFilters, signal?: AbortSignal) => api.get<PlanOut[]>(`${V}/plans${query(filters)}`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<PlanOut>(plan(id), { signal }),
  create: (body: PlanCreate) => api.post<PlanOut>(`${V}/plans`, body),
  update: (id: string, body: PlanUpdate) => api.patch<PlanOut>(plan(id), body),
  remove: (id: string) => api.delete<void>(plan(id)),
  copy: (id: string, body: PlanCopyIn) => api.post<PlanOut>(`${plan(id)}/copy`, body),
  action: (id: string, action: PlanAction, body?: { reason?: string | null }) => api.post<PlanOut>(`${plan(id)}/${action}`, body),

  lines: (id: string, revision: number | undefined, signal?: AbortSignal) =>
    api.get<LineOut[]>(`${plan(id)}/lines${query({ revision })}`, { signal }),
  addLine: (id: string, body: LineIn) => api.post<LineOut>(`${plan(id)}/lines`, body),
  updateLine: (id: string, lineId: string, body: LineUpdate) => api.patch<LineOut>(`${plan(id)}/lines/${enc(lineId)}`, body),
  deleteLine: (id: string, lineId: string) => api.delete<void>(`${plan(id)}/lines/${enc(lineId)}`),
  importLines: (id: string, file: File, apply: boolean) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<LineImportOut>(`${plan(id)}/lines/import${query({ apply: apply ? "true" : "false" })}`, form);
  },
  downloadTemplate: () => downloadApiFile(`${V}/plans/import-template`, "workforce-plan-template.csv"),

  revisions: (id: string, signal?: AbortSignal) => api.get<RevisionOut[]>(`${plan(id)}/revisions`, { signal }),
  diff: (id: string, n: number, signal?: AbortSignal) => api.get<DiffOut>(`${plan(id)}/revisions/${n}/diff`, { signal }),

  slots: (id: string, status: string | undefined, signal?: AbortSignal) =>
    api.get<SlotOut[]>(`${plan(id)}/slots${query({ status })}`, { signal }),
  convert: (body: ConvertIn) => api.post<ConvertOut>(`${V}/slots/convert`, body),
  cancelSlot: (slotId: string, reason: string) => api.post<SlotOut>(`${V}/slots/${enc(slotId)}/cancel`, { reason }),

  actuals: (id: string, groupBy: GroupBy, signal?: AbortSignal) =>
    api.get<ActualsOut>(`${plan(id)}/actuals${query({ group_by: groupBy })}`, { signal }),
  exportActuals: (id: string, groupBy: GroupBy) =>
    downloadApiFile(`${plan(id)}/actuals/export${query({ group_by: groupBy })}`, `plan-vs-actual-${groupBy}.xlsx`),

  settings: (signal?: AbortSignal) => api.get<WorkforceSettings>(`${V}/settings`, { signal }),
  saveSettings: (body: WorkforceSettingsPatch) => api.patch<WorkforceSettings>(`${V}/settings`, body),
};

export const workforceKeys = {
  all: ["workforce"] as const,
  list: (filters: PlanFilters) => ["workforce", "list", filters] as const,
  detail: (id: string) => ["workforce", "plan", id] as const,
  lines: (id: string, revision: number | undefined) => ["workforce", "plan", id, "lines", revision ?? "current"] as const,
  revisions: (id: string) => ["workforce", "plan", id, "revisions"] as const,
  diff: (id: string, n: number) => ["workforce", "plan", id, "diff", n] as const,
  slots: (id: string, status: string) => ["workforce", "plan", id, "slots", status] as const,
  actuals: (id: string, groupBy: GroupBy) => ["workforce", "plan", id, "actuals", groupBy] as const,
  settings: ["workforce", "settings"] as const,
};

// ---------------------------------------------------------------- client portal
const P = CLIENT_PORTAL_PREFIX;

export const portalForecastsApi = {
  list: (signal?: AbortSignal) => clientPortalRequest<ForecastPortalOut[]>(`${P}/forecasts`, { signal }),
  get: (id: string, signal?: AbortSignal) => clientPortalRequest<ForecastPortalDetail>(`${P}/forecasts/${enc(id)}`, { signal }),
  create: (body: ForecastIn) => clientPortalRequest<ForecastPortalDetail>(`${P}/forecasts`, { method: "POST", body }),
  update: (id: string, body: ForecastUpdate) =>
    clientPortalRequest<ForecastPortalDetail>(`${P}/forecasts/${enc(id)}`, { method: "PATCH", body }),
  remove: (id: string) => clientPortalRequest<void>(`${P}/forecasts/${enc(id)}`, { method: "DELETE" }),
};

export const portalForecastKeys = {
  list: ["client-portal", "forecasts"] as const,
  detail: (id: string) => ["client-portal", "forecasts", id] as const,
};
