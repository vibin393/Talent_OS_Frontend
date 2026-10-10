/**
 * Vendor Portal content API (Epic 17) over `/api/v1/vendor-portal`, on Epic 14's portal transport
 * (`vendorPortalRequest`: CSRF retry, 401 -> vendor sign-in, 403 surfaced for the FR-82 access-denied state).
 */
import type { RequestOptions } from "@/lib/api/client";
import { VENDOR_SIGN_IN, vendorPortalRequest } from "@/lib/api/vendor-portal-client";
import type {
  PortalDashboardOut,
  PortalDocumentOut,
  PortalPlacementOut,
  PortalReleaseOut,
  PortalScorecardOut,
  PortalStatementOut,
  PortalSubmissionOut,
} from "./types";

export { VENDOR_SIGN_IN };
const P = "/api/v1/vendor-portal";
const enc = encodeURIComponent;

function request<T>(path: string, options: Omit<RequestOptions, "skipAuthHandler"> = {}): Promise<T> {
  return vendorPortalRequest<T>(path, options);
}

export const vendorPortalKeys = {
  all: ["vendor-portal"] as const,
  dashboard: ["vendor-portal", "dashboard"] as const,
  releases: ["vendor-portal", "releases"] as const,
  release: (id: string) => ["vendor-portal", "release", id] as const,
  submissions: (releaseId?: string | null) => ["vendor-portal", "submissions", releaseId ?? null] as const,
  submission: (id: string) => ["vendor-portal", "submission", id] as const,
  placements: ["vendor-portal", "placements"] as const,
  documents: ["vendor-portal", "documents"] as const,
  statements: ["vendor-portal", "statements"] as const,
  scorecard: ["vendor-portal", "scorecard"] as const,
};

export const vendorPortalApi = {
  dashboard: (signal?: AbortSignal) => request<PortalDashboardOut>(`${P}/dashboard`, { signal }),
  releases: (signal?: AbortSignal) => request<PortalReleaseOut[]>(`${P}/releases`, { signal }),
  release: (id: string, signal?: AbortSignal) => request<PortalReleaseOut>(`${P}/releases/${enc(id)}`, { signal }),
  submit: (releaseId: string, form: FormData) =>
    request<PortalSubmissionOut>(`${P}/releases/${enc(releaseId)}/submissions`, { method: "POST", body: form }),
  submissions: (releaseId?: string | null, signal?: AbortSignal) =>
    request<PortalSubmissionOut[]>(`${P}/submissions${releaseId ? `?release_id=${enc(releaseId)}` : ""}`, { signal }),
  submission: (id: string, signal?: AbortSignal) => request<PortalSubmissionOut>(`${P}/submissions/${enc(id)}`, { signal }),
  withdraw: (id: string) => request<PortalSubmissionOut>(`${P}/submissions/${enc(id)}/withdraw`, { method: "POST" }),
  reviseResume: (id: string, form: FormData) =>
    request<PortalSubmissionOut>(`${P}/submissions/${enc(id)}/resume`, { method: "POST", body: form }),
  placements: (signal?: AbortSignal) => request<PortalPlacementOut[]>(`${P}/placements`, { signal }),
  documents: (signal?: AbortSignal) => request<PortalDocumentOut[]>(`${P}/documents`, { signal }),
  uploadDocument: (form: FormData) => request<PortalDocumentOut>(`${P}/documents`, { method: "POST", body: form }),
  statements: (signal?: AbortSignal) => request<PortalStatementOut[]>(`${P}/statements`, { signal }),
  statementUrl: (id: string, format: "pdf" | "csv") => `${P}/statements/${enc(id)}/download?format=${format}`,
  fileUrl: (fileId: string) => `${P}/files/${enc(fileId)}/download`,
  scorecard: (signal?: AbortSignal) => request<PortalScorecardOut>(`${P}/scorecard`, { signal }),
};
