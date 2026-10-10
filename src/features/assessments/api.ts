import { api } from "@/lib/api/client";
import { ApiError, toApiError } from "@/lib/api/errors";
import { portalRequest } from "@/lib/api/portal-client";
import type {
  AiSuggestionOut,
  AssessmentBadgesOut,
  AssessmentDetailOut,
  AssessmentOut,
  AssessmentSettingsIn,
  AssessmentTenantSettings,
  AttemptView,
  AutosaveIn,
  AutosaveOut,
  BulkInviteIn,
  BulkInviteOut,
  DraftSection,
  ImportCommitOut,
  ImportPreviewOut,
  InvitationCreate,
  InvitationOut,
  ItemCreate,
  ItemOut,
  ItemUpdate,
  ItemVersionOut,
  ManualResultIn,
  PortalAssessmentOut,
  PreStartOut,
  ProviderTestOut,
  PublishOut,
  ReviewIn,
  ReviewItemOut,
  SignalAnnotation,
  SignalIn,
  SignalsBatchOut,
  SignalsOut,
  SubmissionSharesOut,
  SubmitOut,
} from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";

function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export type ItemFilters = { q?: string; kind?: string; include_archived?: boolean };
export type InvitationFilters = { assessment_id?: string; candidate_id?: string; application_id?: string; status?: string };

export const assessmentsApi = {
  // item bank
  items: (f: ItemFilters, signal?: AbortSignal) => api.get<ItemOut[]>(`${V}/assessment-items${qs(f)}`, { signal }),
  item: (id: string, signal?: AbortSignal) => api.get<ItemOut>(`${V}/assessment-items/${enc(id)}`, { signal }),
  createItem: (body: ItemCreate) => api.post<ItemOut>(`${V}/assessment-items`, body),
  updateItem: (id: string, body: ItemUpdate) => api.put<ItemOut>(`${V}/assessment-items/${enc(id)}`, body),
  archiveItem: (id: string) => api.post<ItemOut>(`${V}/assessment-items/${enc(id)}/archive`),
  itemVersions: (id: string, signal?: AbortSignal) => api.get<ItemVersionOut[]>(`${V}/assessment-items/${enc(id)}/versions`, { signal }),
  importPreview: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<ImportPreviewOut>(`${V}/assessment-items/import`, form);
  },
  importCommit: (batchId: string) => api.post<ImportCommitOut>(`${V}/assessment-items/import/${enc(batchId)}/commit`),

  // assessments
  list: (status: string | undefined, signal?: AbortSignal) => api.get<AssessmentOut[]>(`${V}/assessments${qs({ status })}`, { signal }),
  create: (body: AssessmentSettingsIn) => api.post<AssessmentDetailOut>(`${V}/assessments`, body),
  get: (id: string, signal?: AbortSignal) => api.get<AssessmentDetailOut>(`${V}/assessments/${enc(id)}`, { signal }),
  patch: (id: string, body: Partial<AssessmentSettingsIn>) => api.patch<AssessmentDetailOut>(`${V}/assessments/${enc(id)}`, body),
  saveDraft: (id: string, sections: DraftSection[]) => api.put<AssessmentDetailOut>(`${V}/assessments/${enc(id)}/draft`, { sections }),
  publish: (id: string) => api.post<PublishOut>(`${V}/assessments/${enc(id)}/publish`),
  archive: (id: string) => api.post<AssessmentDetailOut>(`${V}/assessments/${enc(id)}/archive`),
  providerTests: (configId: string | null, signal?: AbortSignal) =>
    api.get<ProviderTestOut[]>(`${V}/assessments/provider-tests${qs({ config_id: configId })}`, { signal }),
  syncProviderCatalogue: (configId: string) => api.post<ProviderTestOut[]>(`${V}/assessments/provider-catalogue/sync`, { config_id: configId }),
  settings: (signal?: AbortSignal) => api.get<AssessmentTenantSettings>(`${V}/assessment-settings`, { signal }),
  saveSettings: (body: AssessmentTenantSettings) => api.put<AssessmentTenantSettings>(`${V}/assessment-settings`, body),

  // invitations
  invite: (body: InvitationCreate) =>
    api.post<InvitationOut>(`${V}/assessment-invitations`, body, body.idempotency_key ? { headers: { "Idempotency-Key": body.idempotency_key } } : undefined),
  bulkInvite: (assessmentId: string, body: BulkInviteIn) => api.post<BulkInviteOut>(`${V}/assessments/${enc(assessmentId)}/invitations/bulk`, body),
  invitations: (f: InvitationFilters, signal?: AbortSignal) => api.get<InvitationOut[]>(`${V}/assessment-invitations${qs(f)}`, { signal }),
  invitation: (id: string, signal?: AbortSignal) => api.get<InvitationOut>(`${V}/assessment-invitations/${enc(id)}`, { signal }),
  patchInvitation: (id: string, body: { screen_reader_mode?: boolean; accommodation_factor?: string }) =>
    api.patch<InvitationOut>(`${V}/assessment-invitations/${enc(id)}`, body),
  extend: (id: string, deadlineAt: string) => api.post<InvitationOut>(`${V}/assessment-invitations/${enc(id)}/extend`, { deadline_at: deadlineAt }),
  cancel: (id: string, reason: string) => api.post<InvitationOut>(`${V}/assessment-invitations/${enc(id)}/cancel`, { reason }),
  decide: (id: string, result: "pass" | "fail", note?: string | null) =>
    api.post<InvitationOut>(`${V}/assessment-invitations/${enc(id)}/decide`, { result, ...(note ? { note } : {}) }),
  manualResult: (id: string, body: ManualResultIn) => api.post<InvitationOut>(`${V}/assessment-invitations/${enc(id)}/manual-result`, body),
  candidateResults: (candidateId: string, signal?: AbortSignal) =>
    api.get<InvitationOut[]>(`${V}/candidates/${enc(candidateId)}/assessment-results`, { signal }),
  badges: (applicationIds: readonly string[], signal?: AbortSignal) =>
    api.get<AssessmentBadgesOut>(`${V}/applications/assessment-badges?ids=${applicationIds.map(enc).join(",")}`, { signal }),

  // review and proctoring
  reviews: (status = "pending", signal?: AbortSignal) => api.get<ReviewItemOut[]>(`${V}/assessment-reviews${qs({ status })}`, { signal }),
  attemptAnswers: (attemptId: string, signal?: AbortSignal) => api.get<ReviewItemOut[]>(`${V}/attempts/${enc(attemptId)}/answers`, { signal }),
  review: (answerId: string, body: ReviewIn) => api.post<ReviewItemOut>(`${V}/attempt-answers/${enc(answerId)}/review`, body),
  aiSuggestion: (answerId: string) => api.post<AiSuggestionOut>(`${V}/attempt-answers/${enc(answerId)}/ai-suggestion`),
  signals: (attemptId: string, signal?: AbortSignal) => api.get<SignalsOut>(`${V}/attempts/${enc(attemptId)}/signals`, { signal }),
  annotate: (attemptId: string, note: string, signalId?: string | null) =>
    api.post<SignalAnnotation>(`${V}/attempts/${enc(attemptId)}/signal-annotations`, { signal_id: signalId ?? null, note }),

  // submissions
  shares: (submissionId: string, signal?: AbortSignal) => api.get<SubmissionSharesOut>(`${V}/submissions/${enc(submissionId)}/assessment-shares`, { signal }),
  saveShares: (submissionId: string, invitationIds: string[]) =>
    api.put<SubmissionSharesOut>(`${V}/submissions/${enc(submissionId)}/assessment-shares`, { invitation_ids: invitationIds }),
};

// ---------------------------------------------------------------- candidate taking (portal and public link)

export const ATTEMPT_SESSION_HEADER = "X-Attempt-Session";

type TakeOptions = { method?: "GET" | "POST" | "PUT"; body?: unknown; signal?: AbortSignal; session?: string | null; keepalive?: boolean };

/** Transport for the taking UI: the same relative paths under two bases (candidate portal or public link). */
export type TakingAdapter = {
  kind: "portal" | "public";
  /** Stable id of the invitation / link (keys the stored attempt session in this tab). */
  key: string;
  request: <T>(path: string, options?: TakeOptions) => Promise<T>;
};

export function portalTakingAdapter(invitationId: string): TakingAdapter {
  const base = `${V}/portal/assessments/${enc(invitationId)}`;
  return {
    kind: "portal",
    key: `portal:${invitationId}`,
    request: <T>(path: string, o: TakeOptions = {}) =>
      portalRequest<T>(`${base}${path}`, {
        method: o.method ?? "GET",
        body: o.body,
        signal: o.signal,
        headers: o.session ? { [ATTEMPT_SESSION_HEADER]: o.session } : undefined,
      }),
  };
}

export function publicTakingAdapter(token: string): TakingAdapter {
  const base = `${V}/public/links/${enc(token)}/assessment`;
  return {
    kind: "public",
    key: `public:${token}`,
    request: async <T>(path: string, o: TakeOptions = {}) => {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (o.body !== undefined) headers["Content-Type"] = "application/json";
      if (o.session) headers[ATTEMPT_SESSION_HEADER] = o.session;
      let res: Response;
      try {
        res = await fetch(`${base}${path}`, {
          method: o.method ?? "GET",
          headers,
          body: o.body === undefined ? undefined : JSON.stringify(o.body),
          credentials: "omit",
          cache: "no-store",
          referrerPolicy: "no-referrer",
          signal: o.signal,
          keepalive: o.keepalive,
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") throw e;
        throw new ApiError(0, "network_error", "Cannot reach the server");
      }
      const text = await res.text().catch(() => "");
      let body: unknown = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }
      if (!res.ok) throw toApiError(res.status, body);
      return body as T;
    },
  };
}

/** Taking endpoints, relative to the adapter's base. */
export function takingApi(a: TakingAdapter) {
  return {
    preStart: (signal?: AbortSignal) => a.request<PreStartOut>("", { signal }),
    start: (noticeId: string | null) => a.request<AttemptView>("/start", { method: "POST", body: { notice_id: noticeId, agreed: true } }),
    attempt: (session: string | null, signal?: AbortSignal) => a.request<AttemptView>("/attempt", { session, signal }),
    save: (session: string | null, body: AutosaveIn) => a.request<AutosaveOut>("/attempt/answers", { method: "PUT", body, session }),
    finishSection: (session: string | null, key: string) => a.request<AttemptView>(`/attempt/sections/${enc(key)}/finish`, { method: "POST", session }),
    signals: (session: string | null, signals: SignalIn[]) => a.request<SignalsBatchOut>("/attempt/signals", { method: "POST", body: { signals }, session }),
    submit: (session: string | null) => a.request<SubmitOut>("/attempt/submit", { method: "POST", session }),
  };
}

export const portalAssessmentsApi = {
  list: (signal?: AbortSignal) => portalRequest<PortalAssessmentOut[]>(`${V}/portal/assessments`, { signal }),
};
