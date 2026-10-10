import { api } from "@/lib/api/client";
import { downloadApiFile } from "@/lib/api/download";
import { ApiError, toApiError } from "@/lib/api/errors";
import { registrationQuery } from "./logic";
import type {
  AutoSlotOut,
  BatchIn,
  BatchOut,
  BulkOffersIn,
  BulkOffersOut,
  CampusSettings,
  ConfirmIn,
  ConfirmOut,
  ContactIn,
  ContactOut,
  ContactPatch,
  DriveIn,
  DriveListItem,
  DriveOut,
  DrivePatch,
  DriveStatus,
  FunnelOut,
  ImportApplyOut,
  ImportPreviewOut,
  InstitutionDetailOut,
  InstitutionFilters,
  InstitutionIn,
  InstitutionOut,
  InstitutionPatch,
  InviteIn,
  InviteOut,
  JoiningRow,
  ProposalOut,
  ProposeIn,
  PublicDriveView,
  PublicEventRegisterIn,
  PublicEventRegisterOut,
  PublicEventView,
  PublicRegisterIn,
  PublicRegisterOut,
  RegistrationFilters,
  RegistrationOut,
  RegistrationPage,
} from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";
const C = `${V}/campus`;

function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const campusApi = {
  settings: (signal?: AbortSignal) => api.get<CampusSettings>(`${C}/settings`, { signal }),
  saveSettings: (body: CampusSettings) => api.put<CampusSettings>(`${C}/settings`, body),

  // institutions
  institutions: (f: InstitutionFilters, signal?: AbortSignal) =>
    api.get<InstitutionOut[]>(`${C}/institutions${qs({ q: f.q, status: f.status, tier: f.tier })}`, { signal }),
  institution: (id: string, signal?: AbortSignal) => api.get<InstitutionDetailOut>(`${C}/institutions/${enc(id)}`, { signal }),
  createInstitution: (body: InstitutionIn) => api.post<InstitutionDetailOut>(`${C}/institutions`, body),
  updateInstitution: (id: string, body: InstitutionPatch) => api.patch<InstitutionDetailOut>(`${C}/institutions/${enc(id)}`, body),
  archiveInstitution: (id: string) => api.delete<InstitutionDetailOut>(`${C}/institutions/${enc(id)}`),
  addContact: (id: string, body: ContactIn) => api.post<ContactOut>(`${C}/institutions/${enc(id)}/contacts`, body),
  updateContact: (id: string, contactId: string, body: ContactPatch) =>
    api.patch<ContactOut>(`${C}/institutions/${enc(id)}/contacts/${enc(contactId)}`, body),
  archiveContact: (id: string, contactId: string) =>
    api.delete<ContactOut>(`${C}/institutions/${enc(id)}/contacts/${enc(contactId)}`),

  // drives
  drives: (f: { q?: string; status?: DriveStatus | "" }, signal?: AbortSignal) =>
    api.get<DriveListItem[]>(`${C}/drives${qs({ q: f.q, status: f.status })}`, { signal }),
  drive: (id: string, signal?: AbortSignal) => api.get<DriveOut>(`${C}/drives/${enc(id)}`, { signal }),
  createDrive: (body: DriveIn) => api.post<DriveOut>(`${C}/drives`, body),
  updateDrive: (id: string, body: DrivePatch) => api.patch<DriveOut>(`${C}/drives/${enc(id)}`, body),
  addInstitution: (id: string, institutionId: string, cap: number | null) =>
    api.post<DriveOut>(`${C}/drives/${enc(id)}/institutions`, { institution_id: institutionId, registration_cap: cap }),
  updateDriveInstitution: (id: string, diid: string, body: { registration_cap?: number | null; status?: "active" | "paused" }) =>
    api.patch<DriveOut>(`${C}/drives/${enc(id)}/institutions/${enc(diid)}`, body),
  removeInstitution: (id: string, diid: string) => api.delete<DriveOut>(`${C}/drives/${enc(id)}/institutions/${enc(diid)}`),
  addDemand: (id: string, demandId: string) => api.post<DriveOut>(`${C}/drives/${enc(id)}/demands`, { demand_id: demandId }),
  removeDemand: (id: string, demandId: string) => api.delete<DriveOut>(`${C}/drives/${enc(id)}/demands/${enc(demandId)}`),
  openRegistration: (id: string) => api.post<DriveOut>(`${C}/drives/${enc(id)}/open-registration`),
  closeRegistration: (id: string) => api.post<DriveOut>(`${C}/drives/${enc(id)}/close-registration`),
  closeDrive: (id: string) => api.post<DriveOut>(`${C}/drives/${enc(id)}/close`),
  cancelDrive: (id: string, reason: string) => api.post<DriveOut>(`${C}/drives/${enc(id)}/cancel`, { reason }),
  qrUrl: (id: string, diid: string, format: "png" | "svg" | "pdf") =>
    `${C}/drives/${enc(id)}/institutions/${enc(diid)}/qr?format=${format}`,
  downloadQr: (id: string, diid: string, format: "png" | "svg" | "pdf") =>
    downloadApiFile(campusApi.qrUrl(id, diid, format), `campus-qr.${format}`),

  // eligibility
  setEligibility: (id: string, filters: unknown) => api.put<DriveOut>(`${C}/drives/${enc(id)}/eligibility`, { filters }),
  overrideEligibility: (registrationId: string, reason: string) =>
    api.post<RegistrationOut>(`${C}/registrations/${enc(registrationId)}/override-eligibility`, { reason }),

  // registrations
  registrations: (driveId: string, f: RegistrationFilters, limit: number, offset: number, signal?: AbortSignal) =>
    api.get<RegistrationPage>(`${C}/drives/${enc(driveId)}/registrations${registrationQuery(f, limit, offset)}`, { signal }),
  registration: (id: string, signal?: AbortSignal) => api.get<RegistrationOut>(`${C}/registrations/${enc(id)}`, { signal }),
  withdraw: (id: string, note: string | null) => api.post<RegistrationOut>(`${C}/registrations/${enc(id)}/withdraw`, { note }),
  renege: (id: string, note: string) => api.post<RegistrationOut>(`${C}/registrations/${enc(id)}/renege`, { note }),

  // placement-officer import
  importPreview: (driveId: string, driveInstitutionId: string, file: File) => {
    const form = new FormData();
    form.append("drive_institution_id", driveInstitutionId);
    form.append("file", file);
    return api.post<ImportPreviewOut>(`${C}/drives/${enc(driveId)}/imports/preview`, form);
  },
  importApply: (driveId: string, batchId: string) =>
    api.post<ImportApplyOut>(`${C}/drives/${enc(driveId)}/imports/${enc(batchId)}/apply`),

  // assessments / shortlist
  invite: (driveId: string, body: InviteIn) => api.post<InviteOut>(`${C}/drives/${enc(driveId)}/assessments/invite`, body),
  propose: (driveId: string, body: ProposeIn) => api.post<ProposalOut>(`${C}/drives/${enc(driveId)}/shortlist/propose`, body),
  confirm: (driveId: string, body: ConfirmIn) => api.post<ConfirmOut>(`${C}/drives/${enc(driveId)}/shortlist/confirm`, body),

  // batches
  batches: (driveId: string, signal?: AbortSignal) => api.get<BatchOut[]>(`${C}/drives/${enc(driveId)}/batches`, { signal }),
  createBatch: (driveId: string, body: BatchIn) => api.post<BatchOut>(`${C}/drives/${enc(driveId)}/batches`, body),
  batch: (id: string, signal?: AbortSignal) => api.get<BatchOut>(`${C}/batches/${enc(id)}`, { signal }),
  autoSlot: (id: string) => api.post<AutoSlotOut>(`${C}/batches/${enc(id)}/auto-slot`),
  moveSlot: (id: string, slotId: string, toSlotId: string) =>
    api.post<BatchOut>(`${C}/batches/${enc(id)}/slots/${enc(slotId)}/move`, { to_slot_id: toSlotId }),
  cancelBatch: (id: string) => api.post<BatchOut>(`${C}/batches/${enc(id)}/cancel`),

  // offers / funnel
  bulkOffers: (driveId: string, body: BulkOffersIn) => api.post<BulkOffersOut>(`${C}/drives/${enc(driveId)}/offers`, body),
  joining: (driveId: string, signal?: AbortSignal) => api.get<JoiningRow[]>(`${C}/drives/${enc(driveId)}/offers`, { signal }),
  withdrawalReasons: (signal?: AbortSignal) => api.get<string[]>(`${C}/offer-withdrawal-reasons`, { signal }),
  funnel: (driveId: string, signal?: AbortSignal) => api.get<FunnelOut>(`${C}/drives/${enc(driveId)}/funnel`, { signal }),
  tenantFunnel: (from: string | null, to: string | null, signal?: AbortSignal) =>
    api.get<FunnelOut>(`${C}/funnel${qs({ from, to })}`, { signal }),

  // Epic 38: "Campus <batch>" talent pool template (`campus_<batch_year>`).
  enableCampusPool: (batchYear: number) =>
    api.post<{ id: string; name: string }>(`${V}/talent-pools/templates/campus_${batchYear}/enable`),
};

export const campusKeys = {
  all: ["campus"] as const,
  settings: ["campus", "settings"] as const,
  institutions: (f: InstitutionFilters) => ["campus", "institutions", f] as const,
  institutionsRoot: ["campus", "institutions"] as const,
  institution: (id: string) => ["campus", "institution", id] as const,
  drives: (f: object) => ["campus", "drives", f] as const,
  drivesRoot: ["campus", "drives"] as const,
  drive: (id: string) => ["campus", "drive", id] as const,
  registrations: (driveId: string, f: RegistrationFilters, limit: number, offset: number) =>
    ["campus", "registrations", driveId, f, limit, offset] as const,
  registrationsRoot: (driveId: string) => ["campus", "registrations", driveId] as const,
  batches: (driveId: string) => ["campus", "batches", driveId] as const,
  joining: (driveId: string) => ["campus", "joining", driveId] as const,
  funnel: (driveId: string) => ["campus", "funnel", driveId] as const,
  withdrawalReasons: ["campus", "withdrawal-reasons"] as const,
};

// ---------------------------------------------------------------- public pages (no session)
const PUB = `${V}/public/campus`;

async function publicFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", ...init });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "network_error", "Cannot reach the server");
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res.status, body);
  if (body === null) throw new ApiError(res.status, "invalid_response", "Unexpected response from server");
  return body as T;
}

/** Multipart body of a drive registration: `payload` (JSON) plus one `file_<key>` per file field. */
export function registrationForm(payload: PublicRegisterIn, files: Record<string, File | null | undefined>): FormData {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  for (const [key, file] of Object.entries(files)) if (file) form.append(`file_${key}`, file);
  return form;
}

export const publicCampusApi = {
  drive: (token: string, signal?: AbortSignal) => publicFetch<PublicDriveView>(`${PUB}/r/${enc(token)}`, { signal }),
  register: (token: string, payload: PublicRegisterIn, files: Record<string, File | null | undefined>) =>
    publicFetch<PublicRegisterOut>(`${PUB}/r/${enc(token)}`, { method: "POST", body: registrationForm(payload, files) }),
  event: (token: string, signal?: AbortSignal) => publicFetch<PublicEventView>(`${PUB}/e/${enc(token)}`, { signal }),
  registerEvent: (token: string, body: PublicEventRegisterIn) =>
    publicFetch<PublicEventRegisterOut>(`${PUB}/e/${enc(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    }),
};
