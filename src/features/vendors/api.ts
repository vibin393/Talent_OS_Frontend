/** Vendors API client (Epic 17) and react-query keys. */
import { api } from "@/lib/api/client";
import type {
  AcceptIn,
  BankAccountOut,
  MarkDuplicateIn,
  RejectIn,
  ReleaseBatchOut,
  ReleaseCreate,
  ReleaseOut,
  StatementBuildIn,
  StatementBuildOut,
  StatementDetailOut,
  StatementOut,
  VendorCreate,
  VendorDetailOut,
  VendorDocumentOut,
  VendorOut,
  VendorScorecard,
  VendorSettingsOut,
  VendorSettingsUpdate,
  VendorStatus,
  VendorSubmissionOut,
  VendorTier,
  VendorUpdate,
} from "./types";

const V = "/api/v1";
const enc = encodeURIComponent;

export type VendorFilters = { q: string; status: VendorStatus | null; tier: VendorTier | null };
export const EMPTY_VENDOR_FILTERS: VendorFilters = { q: "", status: null, tier: null };

export function vendorQuery(f: VendorFilters): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim().slice(0, 200));
  if (f.status) p.set("status", f.status);
  if (f.tier) p.set("tier", f.tier);
  return p.toString();
}

export const vendorKeys = {
  all: ["vendors"] as const,
  list: (f: VendorFilters) => ["vendors", "list", f] as const,
  detail: (id: string) => ["vendors", "detail", id] as const,
  documents: (id: string) => ["vendors", "documents", id] as const,
  releases: (id: string) => ["vendors", "releases", id] as const,
  performance: (id: string) => ["vendors", "performance", id] as const,
  league: ["vendors", "league"] as const,
  settings: ["vendors", "settings"] as const,
  demandReleases: (demandId: string) => ["vendors", "demand-releases", demandId] as const,
  queue: (status: string | null, vendorId?: string | null) => ["vendors", "queue", status, vendorId ?? null] as const,
  submission: (id: string) => ["vendors", "submission", id] as const,
  statements: (vendorId?: string | null) => ["vendors", "statements", vendorId ?? null] as const,
  statement: (id: string) => ["vendors", "statement", id] as const,
};

export const vendorsApi = {
  list: (f: VendorFilters, signal?: AbortSignal) => {
    const q = vendorQuery(f);
    return api.get<VendorOut[]>(`${V}/vendors${q ? `?${q}` : ""}`, { signal });
  },
  get: (id: string, signal?: AbortSignal) => api.get<VendorDetailOut>(`${V}/vendors/${enc(id)}`, { signal }),
  create: (body: VendorCreate) => api.post<VendorDetailOut>(`${V}/vendors`, body),
  update: (id: string, body: VendorUpdate) => api.patch<VendorDetailOut>(`${V}/vendors/${enc(id)}`, body),
  transition: (id: string, to: VendorStatus, reason?: string | null) =>
    api.post<VendorDetailOut>(`${V}/vendors/${enc(id)}/transition`, { to, reason: reason || null }),
  reveal: (id: string, field: "pan" | "bank_account", bankAccountId?: string) =>
    api.post<{ field: string; value: string }>(`${V}/vendors/${enc(id)}/reveal`, {
      field,
      bank_account_id: bankAccountId ?? null,
    }),
  addGstin: (id: string, gstin: string, stateCode: string) =>
    api.post(`${V}/vendors/${enc(id)}/gstins`, { gstin, state_code: stateCode }),
  requestBank: (id: string, body: { account_name: string; account_no: string; ifsc: string; is_primary: boolean }) =>
    api.post<BankAccountOut>(`${V}/vendors/${enc(id)}/bank-accounts`, body),
  documents: (id: string, signal?: AbortSignal) =>
    api.get<VendorDocumentOut[]>(`${V}/vendors/${enc(id)}/documents`, { signal }),
  uploadDocument: (id: string, form: FormData) => api.post<VendorDocumentOut>(`${V}/vendors/${enc(id)}/documents`, form),
  markReviewed: (id: string, documentId: string) =>
    api.post<void>(`${V}/vendors/${enc(id)}/documents/${enc(documentId)}/reviewed`),
  vendorReleases: (id: string, signal?: AbortSignal) =>
    api.get<ReleaseOut[]>(`${V}/vendors/${enc(id)}/releases`, { signal }),
  performance: (id: string, signal?: AbortSignal) =>
    api.get<VendorScorecard>(`${V}/vendors/${enc(id)}/performance`, { signal }),
  league: (signal?: AbortSignal) => api.get<VendorScorecard[]>(`${V}/vendors/performance`, { signal }),
  settings: (signal?: AbortSignal) => api.get<VendorSettingsOut>(`${V}/vendors/settings`, { signal }),
  updateSettings: (body: VendorSettingsUpdate) => api.patch<VendorSettingsOut>(`${V}/vendors/settings`, body),
  // releases
  demandReleases: (demandId: string, signal?: AbortSignal) =>
    api.get<ReleaseOut[]>(`${V}/demands/${enc(demandId)}/vendor-releases`, { signal }),
  release: (demandId: string, body: ReleaseCreate) =>
    api.post<ReleaseBatchOut>(`${V}/demands/${enc(demandId)}/vendor-releases`, body),
  releaseAction: (releaseId: string, action: "pause" | "resume" | "withdraw") =>
    api.post<ReleaseOut>(`${V}/vendor-releases/${enc(releaseId)}/${action}`),
  // review
  queue: (status: string | null, vendorId?: string | null, signal?: AbortSignal) => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (vendorId) p.set("vendor_id", vendorId);
    const q = p.toString();
    return api.get<VendorSubmissionOut[]>(`${V}/vendor-submissions${q ? `?${q}` : ""}`, { signal });
  },
  submission: (id: string, signal?: AbortSignal) =>
    api.get<VendorSubmissionOut>(`${V}/vendor-submissions/${enc(id)}`, { signal }),
  accept: (id: string, body: AcceptIn) => api.post<VendorSubmissionOut>(`${V}/vendor-submissions/${enc(id)}/accept`, body),
  reject: (id: string, body: RejectIn) => api.post<VendorSubmissionOut>(`${V}/vendor-submissions/${enc(id)}/reject`, body),
  markDuplicate: (id: string, body: MarkDuplicateIn) =>
    api.post<VendorSubmissionOut>(`${V}/vendor-submissions/${enc(id)}/mark-duplicate`, body),
  reopen: (id: string, reason: string) =>
    api.post<VendorSubmissionOut>(`${V}/vendor-submissions/${enc(id)}/reopen`, { reason }),
  // statements
  statements: (vendorId?: string | null, signal?: AbortSignal) =>
    api.get<StatementOut[]>(`${V}/vendor-statements${vendorId ? `?vendor_id=${enc(vendorId)}` : ""}`, { signal }),
  statement: (id: string, signal?: AbortSignal) =>
    api.get<StatementDetailOut>(`${V}/vendor-statements/${enc(id)}`, { signal }),
  build: (body: StatementBuildIn) => api.post<StatementBuildOut>(`${V}/vendor-statements/build`, body),
  finalize: (id: string) => api.post<StatementDetailOut>(`${V}/vendor-statements/${enc(id)}/finalize`),
  deleteDraft: (id: string) => api.delete<void>(`${V}/vendor-statements/${enc(id)}`),
  downloadUrl: (id: string, format: "pdf" | "csv") => `${V}/vendor-statements/${enc(id)}/download?format=${format}`,
};
