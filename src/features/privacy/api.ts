import { api } from "@/lib/api/client";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type {
  AIBasisOut,
  AIProcessingBasis,
  ConsentNoticeCreate,
  ConsentNoticeOut,
  ConsentRequestIn,
  ConsentRequestResult,
  DsrCreate,
  DsrDetailOut,
  DsrExecuteIn,
  DsrKind,
  DsrOut,
  DsrStatus,
  DsrTransitionIn,
  DsrUpdate,
  ErasureRunOut,
  LegalHoldCreate,
  LegalHoldOut,
  Page,
  RetentionItemOut,
  RetentionPolicyOut,
  RetentionPolicyUpdate,
  RetentionRunOut,
  SupportGrantOut,
} from "@/lib/api/types";

const enc = encodeURIComponent;
const P = "/api/v1/privacy";

export type DsrFilters = { status: DsrStatus | null; kind: DsrKind | null; overdue: boolean };

export const EMPTY_DSR_FILTERS: DsrFilters = { status: null, kind: null, overdue: false };

export function dsrListQuery(filters: DsrFilters, page: number, pageSize: number): string {
  const p = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (filters.status) p.set("status", filters.status);
  if (filters.kind) p.set("kind", filters.kind);
  if (filters.overdue) p.set("overdue", "true");
  return p.toString();
}

export const privacyApi = {
  aiBasis: (signal?: AbortSignal) => api.get<AIBasisOut>(`${P}/ai-basis`, { signal }),
  setAiBasis: (basis: AIProcessingBasis) => api.put<AIBasisOut>(`${P}/ai-basis`, { basis }),

  notices: (signal?: AbortSignal) => api.get<ConsentNoticeOut[]>(`${P}/consent-notices`, { signal }),
  createNotice: (body: ConsentNoticeCreate) => api.post<ConsentNoticeOut>(`${P}/consent-notices`, body),
  activateNotice: (id: string) => api.post<ConsentNoticeOut>(`${P}/consent-notices/${enc(id)}/activate`),

  sendConsentRequests: (body: ConsentRequestIn) => api.post<ConsentRequestResult>(`${P}/consent-requests`, body),

  dsrs: (filters: DsrFilters, page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Page<DsrOut>>(`${P}/dsrs?${dsrListQuery(filters, page, pageSize)}`, { signal }),
  createDsr: (body: DsrCreate) => api.post<DsrOut>(`${P}/dsrs`, body),
  dsr: (id: string, signal?: AbortSignal) => api.get<DsrDetailOut>(`${P}/dsrs/${enc(id)}`, { signal }),
  updateDsr: (id: string, body: DsrUpdate) => api.patch<DsrDetailOut>(`${P}/dsrs/${enc(id)}`, body),
  verifyIdentity: (id: string) => api.post<DsrDetailOut>(`${P}/dsrs/${enc(id)}/verify-identity`),
  transitionDsr: (id: string, body: DsrTransitionIn) => api.post<DsrDetailOut>(`${P}/dsrs/${enc(id)}/transition`, body),
  executeDsr: (id: string, body: DsrExecuteIn) => api.post<DsrDetailOut>(`${P}/dsrs/${enc(id)}/execute`, body),
  erasureRun: (id: string, signal?: AbortSignal) => api.get<ErasureRunOut>(`${P}/erasure-runs/${enc(id)}`, { signal }),
  retryErasure: (id: string) => api.post<ErasureRunOut>(`${P}/erasure-runs/${enc(id)}/retry`),

  legalHolds: (active: boolean, signal?: AbortSignal) =>
    api.get<LegalHoldOut[]>(`${P}/legal-holds?active=${active}`, { signal }),
  placeHold: (body: LegalHoldCreate) => api.post<LegalHoldOut>(`${P}/legal-holds`, body),
  releaseHold: (id: string) => api.post<LegalHoldOut>(`${P}/legal-holds/${enc(id)}/release`),

  retentionPolicy: (signal?: AbortSignal) => api.get<RetentionPolicyOut>(`${P}/retention/policy`, { signal }),
  setRetentionPolicy: (body: RetentionPolicyUpdate) => api.put<RetentionPolicyOut>(`${P}/retention/policy`, body),
  previewRetention: (months: number | null) =>
    api.post<RetentionRunOut>(`${P}/retention/preview`, { candidate_inactive_months: months }),
  retentionRuns: (page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Page<RetentionRunOut>>(`${P}/retention/runs?page=${page}&page_size=${pageSize}`, { signal }),
  retentionRun: (id: string, signal?: AbortSignal) =>
    api.get<RetentionRunOut>(`${P}/retention/runs/${enc(id)}`, { signal }),
  retentionItems: (id: string, page: number, pageSize: number, signal?: AbortSignal) =>
    api.get<Page<RetentionItemOut>>(`${P}/retention/runs/${enc(id)}/items?page=${page}&page_size=${pageSize}`, {
      signal,
    }),
  executeRetention: (id: string, confirm: string) =>
    api.post<RetentionRunOut>(`${P}/retention/runs/${enc(id)}/execute`, { confirm }),
  cancelRetention: (id: string) => api.post<RetentionRunOut>(`${P}/retention/runs/${enc(id)}/cancel`),

  supportAccess: (signal?: AbortSignal) => api.get<SupportGrantOut[]>(`${P}/support-access`, { signal }),
  decideSupport: (id: string, action: "approve" | "deny" | "revoke") =>
    api.post<SupportGrantOut>(`${P}/support-access/${enc(id)}/${action}`),
};

export const privacyKeys = {
  all: ["privacy"] as const,
  aiBasis: ["privacy", "ai-basis"] as const,
  notices: ["privacy", "notices"] as const,
  dsrs: ["privacy", "dsrs"] as const,
  dsrList: (filters: DsrFilters, page: number, pageSize: number) => ["privacy", "dsrs", "list", filters, page, pageSize] as const,
  dsr: (id: string) => ["privacy", "dsrs", "detail", id] as const,
  erasureRun: (id: string) => ["privacy", "erasure-runs", id] as const,
  holds: (active: boolean) => ["privacy", "legal-holds", active] as const,
  retentionPolicy: ["privacy", "retention", "policy"] as const,
  retentionRuns: ["privacy", "retention", "runs"] as const,
  retentionRun: (id: string) => ["privacy", "retention", "runs", id] as const,
  retentionRunList: (page: number) => ["privacy", "retention", "runs", "list", page] as const,
  retentionItems: (id: string, page: number) => ["privacy", "retention", "runs", id, "items", page] as const,
  supportAccess: ["privacy", "support-access"] as const,
};

const MESSAGES: Record<string, string> = {
  identity_not_verified: "Verify the requester's identity before executing this request.",
  legal_hold_active: "The candidate is under a legal hold. Release the hold before erasing.",
  use_candidate_edit: "Correct the candidate's profile directly, then complete the request with a note.",
  dsr_closed: "This request is already closed.",
  dsr_no_candidate: "Link the request to a candidate first.",
  preview_expired: "This preview is older than 7 days. Run a new preview.",
  invalid_transition: "This change is not allowed from the request's current status.",
  forbidden: "You do not have permission to do this.",
};

/** User-facing message for a privacy API failure. */
export function privacyErrorMessage(e: unknown): string {
  if (isApiError(e)) {
    if (e.code === "legal_hold_active" && typeof e.details.reason === "string") {
      return `The candidate is under a legal hold: ${e.details.reason}`;
    }
    const known = MESSAGES[e.code];
    if (known) return known;
    if (e.status === 404) return "This item no longer exists. Refresh and try again.";
  }
  return errorMessage(e);
}
