/** Payroll Export API (Epic 28): internal `/api/v1/payroll/*` (tenant session). Finalize sends an Idempotency-Key. */
import { api } from "@/lib/api/client";
import { newIdempotencyKey } from "./format";
import type {
  CatalogueField,
  ExceptionsOut,
  FileFormat,
  ItemOut,
  MappingIn,
  MappingOut,
  MappingUpdate,
  PayCalendarIn,
  PayCalendarOut,
  PayPeriodOut,
  PayrollConnectorOut,
  PayrollSettingsOut,
  PayrollSettingsUpdate,
  RowOut,
  VersionOut,
} from "./types";

const enc = encodeURIComponent;
const P = "/api/v1/payroll";

function qs(params: Record<string, string | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const payrollApi = {
  settings: (signal?: AbortSignal) => api.get<PayrollSettingsOut>(`${P}/settings`, { signal }),
  updateSettings: (body: PayrollSettingsUpdate) => api.patch<PayrollSettingsOut>(`${P}/settings`, body),
  calendar: (le: string, signal?: AbortSignal) => api.get<PayCalendarOut>(`${P}/calendars/${enc(le)}`, { signal }),
  putCalendar: (le: string, body: PayCalendarIn) => api.put<PayCalendarOut>(`${P}/calendars/${enc(le)}`, body),
  connector: (le: string, signal?: AbortSignal) => api.get<PayrollConnectorOut>(`${P}/connector/${enc(le)}`, { signal }),
  putConnector: (le: string, provider_key: string) => api.put<PayrollConnectorOut>(`${P}/connector/${enc(le)}`, { provider_key }),
  periods: (le: string | null, signal?: AbortSignal) =>
    api.get<PayPeriodOut[]>(`${P}/periods${qs({ legal_entity_id: le })}`, { signal }),
  period: (id: string, signal?: AbortSignal) => api.get<PayPeriodOut>(`${P}/periods/${enc(id)}`, { signal }),
  exceptions: (id: string, signal?: AbortSignal) => api.get<ExceptionsOut>(`${P}/periods/${enc(id)}/exceptions`, { signal }),
  preview: (id: string, excludeExceptions: boolean) =>
    api.post<VersionOut>(`${P}/periods/${enc(id)}/previews`, { exclude_exceptions: excludeExceptions }),
  reopen: (id: string, reason: string) => api.post<PayPeriodOut>(`${P}/periods/${enc(id)}/reopen`, { reason }),
  versions: (periodId: string, signal?: AbortSignal) =>
    api.get<VersionOut[]>(`${P}/versions${qs({ period_id: periodId })}`, { signal }),
  rows: (versionId: string, signal?: AbortSignal) => api.get<RowOut[]>(`${P}/versions/${enc(versionId)}/rows`, { signal }),
  items: (versionId: string, rowId: string, signal?: AbortSignal) =>
    api.get<ItemOut[]>(`${P}/versions/${enc(versionId)}/rows/${enc(rowId)}/items`, { signal }),
  deletePreview: (versionId: string) => api.delete<void>(`${P}/versions/${enc(versionId)}`),
  finalize: (versionId: string, key?: string) =>
    api.post<VersionOut>(`${P}/versions/${enc(versionId)}/finalize`, undefined, {
      headers: { "Idempotency-Key": key ?? newIdempotencyKey() },
    }),
  markProcessed: (versionId: string, payrollReference: string | null) =>
    api.post<VersionOut>(`${P}/versions/${enc(versionId)}/mark-processed`, { payroll_reference: payrollReference }),
  filePath: (versionId: string, format: FileFormat, mappingId?: string | null) =>
    `${P}/versions/${enc(versionId)}/file${qs({ format, mapping_id: mappingId })}`,
  mappings: (signal?: AbortSignal) => api.get<MappingOut[]>(`${P}/mappings`, { signal }),
  catalogue: (signal?: AbortSignal) => api.get<CatalogueField[]>(`${P}/mappings/catalogue`, { signal }),
  createMapping: (body: MappingIn) => api.post<MappingOut>(`${P}/mappings`, body),
  updateMapping: (id: string, body: MappingUpdate) => api.patch<MappingOut>(`${P}/mappings/${enc(id)}`, body),
};

export const payrollKeys = {
  all: ["payroll"] as const,
  settings: ["payroll", "settings"] as const,
  calendar: (le: string) => ["payroll", "calendar", le] as const,
  connector: (le: string) => ["payroll", "connector", le] as const,
  periods: (le: string | null) => ["payroll", "periods", le ?? "all"] as const,
  period: (id: string) => ["payroll", "period", id] as const,
  exceptions: (id: string) => ["payroll", "exceptions", id] as const,
  versions: (periodId: string) => ["payroll", "versions", periodId] as const,
  rows: (versionId: string) => ["payroll", "rows", versionId] as const,
  items: (versionId: string, rowId: string) => ["payroll", "items", versionId, rowId] as const,
  mappings: ["payroll", "mappings"] as const,
  catalogue: ["payroll", "catalogue"] as const,
};
