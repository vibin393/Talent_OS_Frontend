/**
 * HRMS sync client (Epic 71): settings, field mappings, sensitive toggles, the sync queue, the Placement panel and
 * the manual import file. Hand-written DTOs mirror `app/schemas/hrms_sync.py`. Endpoints under `/api/v1/hrms/*`.
 */
import { api, CSRF_HEADER, readCookie } from "@/lib/api/client";
import { filenameFromDisposition } from "@/lib/api/download";
import { ApiError, toApiError } from "@/lib/api/errors";
import type { Page } from "@/lib/api/types";

const H = "/api/v1/hrms";
const enc = encodeURIComponent;

export type Transform = "none" | "date_iso" | "date_dmy" | "upper" | "lower" | "lookup";
export type HrmsRecordStatus = "pending" | "blocked" | "synced" | "failed" | "skipped";

export type HrmsSettings = {
  push_worker_types: string[];
  push_on_join: boolean;
  push_changes: boolean;
  push_exits: boolean;
  pull_hour_ist: number;
};
export type HrmsSettingsIn = Partial<HrmsSettings>;

export type MappingOut = {
  id: string;
  hrms_field: string;
  local_field: string | null;
  constant: string | null;
  transform: string;
  lookup: Record<string, string>;
  sensitive: boolean;
  purpose: string | null;
  enabled_by: string | null;
  enabled_at: string | null;
};

export type HrmsFieldOut = {
  hrms_field: string;
  label: string;
  required: boolean;
  kind: string;
  options: { value: string; label: string }[];
  custom: boolean;
  mapping: MappingOut | null;
};

export type CatalogueFieldOut = { key: string; label: string; sensitive: boolean };

export type MappingPageOut = {
  installation_id: string;
  legal_entity_id: string;
  connector_key: string;
  custom_fields_allowed: boolean;
  fields: HrmsFieldOut[];
  catalogue: CatalogueFieldOut[];
};

export type MappingIn = {
  hrms_field: string;
  local_field?: string | null;
  constant?: string | null;
  transform: Transform;
  lookup: Record<string, string>;
};

export type HrmsRecordOut = {
  id: string;
  installation_id: string;
  legal_entity_id: string;
  placement_id: string;
  candidate_id: string;
  include_override: boolean | null;
  employee_ref: string | null;
  employee_code: string | null;
  pushed_version: number;
  last_push_kind: string | null;
  status: string;
  blocked_fields: string[];
  skip_reason: string | null;
  last_message: string | null;
  last_pushed_at: string | null;
  hrms_status: string | null;
  hrms_exit_date: string | null;
  last_pulled_at: string | null;
  mismatch: string;
  mismatch_task_id: string | null;
  updated_at: string;
  worker_name: string | null;
  placement_human_id: string | null;
};

export type PlacementPanelOut = {
  placement_id: string;
  eligible: boolean;
  reason: string | null;
  installation_id: string | null;
  connector_key: string | null;
  record: HrmsRecordOut | null;
  placement_status: string;
};

export const hrmsKeys = {
  all: ["hrms-sync"] as const,
  settings: ["hrms-sync", "settings"] as const,
  mappings: (inst: string, le: string) => ["hrms-sync", "mappings", inst, le] as const,
  records: (status?: string, le?: string, mismatch?: boolean) => ["hrms-sync", "records", status ?? "", le ?? "", !!mismatch] as const,
  placement: (id: string) => ["hrms-sync", "placement", id] as const,
};

export const hrmsApi = {
  settings: (signal?: AbortSignal) => api.get<HrmsSettings>(`${H}/settings`, { signal }),
  saveSettings: (body: HrmsSettingsIn) => api.put<HrmsSettings>(`${H}/settings`, body),
  mappings: (inst: string, le: string, signal?: AbortSignal) =>
    api.get<MappingPageOut>(`${H}/installations/${enc(inst)}/entities/${enc(le)}/mappings`, { signal }),
  saveMappings: (inst: string, le: string, items: MappingIn[]) =>
    api.put<MappingPageOut>(`${H}/installations/${enc(inst)}/entities/${enc(le)}/mappings`, { items }),
  enableSensitive: (mappingId: string, purpose: string) =>
    api.post<MappingOut>(`${H}/mappings/${enc(mappingId)}/enable-sensitive`, { purpose }),
  disableSensitive: (mappingId: string) => api.post<MappingOut>(`${H}/mappings/${enc(mappingId)}/disable-sensitive`),
  records: (params: { status?: string; legal_entity_id?: string; mismatch?: boolean; page?: number }, signal?: AbortSignal) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.legal_entity_id) q.set("legal_entity_id", params.legal_entity_id);
    if (params.mismatch) q.set("mismatch", "true");
    if (params.page) q.set("page", String(params.page));
    return api.get<Page<HrmsRecordOut>>(`${H}/records?${q.toString()}`, { signal });
  },
  placement: (placementId: string, signal?: AbortSignal) => api.get<PlacementPanelOut>(`${H}/placements/${enc(placementId)}`, { signal }),
  retry: (recordId: string) => api.post<{ job_id: string; status: string }>(`${H}/records/${enc(recordId)}/retry`),
  skip: (recordId: string, reason: string) => api.post<HrmsRecordOut>(`${H}/records/${enc(recordId)}/skip`, { reason }),
  include: (placementId: string, include: boolean) => api.post<PlacementPanelOut>(`${H}/placements/${enc(placementId)}/include`, { include }),
  pullNow: (inst: string) => api.post<{ job_id: string; status: string }>(`${H}/installations/${enc(inst)}/pull`),
  /** Builds and downloads the HRMS import CSV (POST returns the file body). */
  async downloadImportFile(inst: string, le: string): Promise<void> {
    const path = `${H}/installations/${enc(inst)}/entities/${enc(le)}/import-file`;
    const headers: Record<string, string> = { Accept: "text/csv" };
    const csrf = readCookie("tos_csrf");
    if (csrf) headers[CSRF_HEADER] = csrf;
    let res: Response;
    try {
      res = await fetch(path, { method: "POST", headers, credentials: "include", cache: "no-store" });
    } catch {
      throw new ApiError(0, "network_error", "Cannot reach the server");
    }
    if (!res.ok) throw toApiError(res.status, await res.json().catch(() => null));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filenameFromDisposition(res.headers.get("Content-Disposition")) ?? "hrms-import.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
