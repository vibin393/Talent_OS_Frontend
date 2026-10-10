import { pageParams } from "@/features/admin/query";
import { api } from "@/lib/api/client";
import type {
  ApplicationDetailOut,
  ApplicationOut,
  ApplicationsCreate,
  ApplicationsCreateOut,
  ApplicationTransitionIn,
  ApplyUpdatesOut,
  BulkTransitionIn,
  BulkTransitionOut,
  CandidateApplicationOut,
  CandidateConsentOut,
  ClientFeedbackIn,
  ClientFeedbackOut,
  MarginOut,
  MarginPreviewIn,
  Page,
  PipelineBoardOut,
  PipelineConsentRequestIn,
  PipelineReasonCodeCreate,
  PipelineReasonCodeOut,
  PipelineReasonKind,
  PipelineSettingsOut,
  PipelineSettingsUpdate,
  PipelineStageCreate,
  PipelineStageOut,
  PipelineStagesOut,
  QuestionnaireCreate,
  QuestionnaireOut,
  QuestionnaireUpdate,
  ConsentRequestResult,
  ScreeningCreate,
  ScreeningFormOut,
  ScreeningOut,
  ScreeningOutcomeIn,
  ScreeningUpdate,
  SecureLinkOut,
  SubmissionOut,
  SubmissionPreviewIn,
  SubmissionPreviewOut,
  SubmissionsCreate,
  SubmissionsCreateOut,
} from "@/lib/api/types";

const enc = encodeURIComponent;
const V = "/api/v1";
const P = `${V}/pipeline`;

/** Every Epic 6 endpoint the internal app calls (the public secure-link pages use `public-links/api`). */
export const pipelineApi = {
  // ---------------------------------------------------------------- configuration
  settings: (signal?: AbortSignal) => api.get<PipelineSettingsOut>(`${P}/settings`, { signal }),
  updateSettings: (body: PipelineSettingsUpdate) => api.patch<PipelineSettingsOut>(`${P}/settings`, body),
  stages: (includeTransitions: boolean, signal?: AbortSignal) =>
    api.get<PipelineStagesOut>(`${P}/stages${includeTransitions ? "?include_transitions=true" : ""}`, { signal }),
  createStage: (body: PipelineStageCreate) => api.post<PipelineStageOut>(`${P}/stages`, body),
  updateStage: (id: string, label: string) => api.patch<PipelineStageOut>(`${P}/stages/${enc(id)}`, { label }),
  reorderStages: (stageIds: string[]) => api.post<PipelineStagesOut>(`${P}/stages/reorder`, { stage_ids: stageIds }),
  archiveStage: (id: string, moveToStageId: string | null) =>
    api.post<PipelineStageOut>(`${P}/stages/${enc(id)}/archive`, { move_to_stage_id: moveToStageId }),
  reasonCodes: (kind: PipelineReasonKind | null, includeArchived: boolean, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (kind) params.set("kind", kind);
    if (includeArchived) params.set("include_archived", "true");
    const qs = params.toString();
    return api.get<PipelineReasonCodeOut[]>(`${P}/reason-codes${qs ? `?${qs}` : ""}`, { signal });
  },
  createReasonCode: (body: PipelineReasonCodeCreate) => api.post<PipelineReasonCodeOut>(`${P}/reason-codes`, body),
  updateReasonCode: (id: string, label: string) =>
    api.patch<PipelineReasonCodeOut>(`${P}/reason-codes/${enc(id)}`, { label }),
  archiveReasonCode: (id: string) => api.post<PipelineReasonCodeOut>(`${P}/reason-codes/${enc(id)}/archive`),
  questionnaires: (includeArchived: boolean, signal?: AbortSignal) =>
    api.get<QuestionnaireOut[]>(`${P}/questionnaires${includeArchived ? "?include_archived=true" : ""}`, { signal }),
  createQuestionnaire: (body: QuestionnaireCreate) => api.post<QuestionnaireOut>(`${P}/questionnaires`, body),
  updateQuestionnaire: (id: string, body: QuestionnaireUpdate) =>
    api.patch<QuestionnaireOut>(`${P}/questionnaires/${enc(id)}`, body),
  archiveQuestionnaire: (id: string) => api.post<QuestionnaireOut>(`${P}/questionnaires/${enc(id)}/archive`),

  // ---------------------------------------------------------------- demand pipeline
  board: (demandId: string, q: string, signal?: AbortSignal) =>
    api.get<PipelineBoardOut>(
      `${V}/demands/${enc(demandId)}/pipeline/board${q ? `?q=${enc(q)}` : ""}`,
      { signal },
    ),
  applications: (
    demandId: string,
    filters: { q: string; stageId: string | null },
    page: number,
    pageSize: number,
    signal?: AbortSignal,
  ) => {
    const params = pageParams(page, pageSize);
    if (filters.q) params.set("q", filters.q);
    if (filters.stageId) params.set("stage_id", filters.stageId);
    return api.get<Page<ApplicationOut>>(`${V}/demands/${enc(demandId)}/applications?${params}`, { signal });
  },
  addCandidates: (demandId: string, body: ApplicationsCreate) =>
    api.post<ApplicationsCreateOut>(`${V}/demands/${enc(demandId)}/applications`, body),
  bulkTransition: (demandId: string, body: BulkTransitionIn) =>
    api.post<BulkTransitionOut>(`${V}/demands/${enc(demandId)}/applications/bulk-transition`, body),

  // ---------------------------------------------------------------- applications
  application: (id: string, signal?: AbortSignal) =>
    api.get<ApplicationDetailOut>(`${V}/applications/${enc(id)}`, { signal }),
  transition: (id: string, body: ApplicationTransitionIn) =>
    api.post<ApplicationDetailOut>(`${V}/applications/${enc(id)}/transition`, body),
  candidateApplications: (candidateId: string, signal?: AbortSignal) =>
    api.get<CandidateApplicationOut[]>(`${V}/candidates/${enc(candidateId)}/applications`, { signal }),

  // ---------------------------------------------------------------- screenings
  screeningForm: (applicationId: string, questionnaireId: string | null, signal?: AbortSignal) =>
    api.get<ScreeningFormOut>(
      `${V}/applications/${enc(applicationId)}/screening-form${questionnaireId ? `?questionnaire_id=${enc(questionnaireId)}` : ""}`,
      { signal },
    ),
  screenings: (applicationId: string, signal?: AbortSignal) =>
    api.get<ScreeningOut[]>(`${V}/applications/${enc(applicationId)}/screenings`, { signal }),
  createScreening: (applicationId: string, body: ScreeningCreate) =>
    api.post<ScreeningOut>(`${V}/applications/${enc(applicationId)}/screenings`, body),
  generateAiScreening: (applicationId: string) =>
    api.post<ScreeningOut>(`${V}/applications/${enc(applicationId)}/ai-screenings`, { action: "generate" }),
  updateScreening: (id: string, body: ScreeningUpdate) => api.patch<ScreeningOut>(`${V}/screenings/${enc(id)}`, body),
  setOutcome: (id: string, body: ScreeningOutcomeIn) =>
    api.post<ScreeningOut>(`${V}/screenings/${enc(id)}/outcome`, body),
  applyCandidateUpdates: (id: string, fields: string[]) =>
    api.post<ApplyUpdatesOut>(`${V}/screenings/${enc(id)}/apply-candidate-updates`, { fields }),
  sendAiScreening: (id: string) => api.post<ScreeningOut>(`${V}/screenings/${enc(id)}/send`),
  reviewScreening: (id: string) => api.post<ScreeningOut>(`${V}/screenings/${enc(id)}/review`),
  retrySummary: (id: string) => api.post<ScreeningOut>(`${V}/screenings/${enc(id)}/summarize`),
  revokeLink: (linkId: string) => api.post<SecureLinkOut>(`${V}/secure-links/${enc(linkId)}/revoke`),

  // ---------------------------------------------------------------- submissions and feedback
  submissions: (demandId: string, signal?: AbortSignal) =>
    api.get<SubmissionOut[]>(`${V}/demands/${enc(demandId)}/submissions`, { signal }),
  submission: (id: string, signal?: AbortSignal) => api.get<SubmissionOut>(`${V}/submissions/${enc(id)}`, { signal }),
  createSubmissions: (demandId: string, body: SubmissionsCreate) =>
    api.post<SubmissionsCreateOut>(`${V}/demands/${enc(demandId)}/submissions`, body),
  marginPreview: (body: MarginPreviewIn, signal?: AbortSignal) =>
    api.post<MarginOut>(`${V}/submissions/margin-preview`, body, { signal }),
  preview: (body: SubmissionPreviewIn, signal?: AbortSignal) =>
    api.post<SubmissionPreviewOut>(`${V}/submissions/preview`, body, { signal }),
  sendSubmission: (id: string) => api.post<SubmissionOut>(`${V}/submissions/${enc(id)}/send`),
  cancelSubmission: (id: string) => api.post<SubmissionOut>(`${V}/submissions/${enc(id)}/cancel`),
  feedback: (submissionId: string, signal?: AbortSignal) =>
    api.get<ClientFeedbackOut[]>(`${V}/submissions/${enc(submissionId)}/feedback`, { signal }),
  recordFeedback: (submissionId: string, body: ClientFeedbackIn) =>
    api.post<ClientFeedbackOut>(`${V}/submissions/${enc(submissionId)}/feedback`, body),
  confirmRejection: (feedbackId: string) =>
    api.post<ClientFeedbackOut>(`${V}/client-feedback/${enc(feedbackId)}/confirm-rejection`),
  dismissRejection: (feedbackId: string) =>
    api.post<ClientFeedbackOut>(`${V}/client-feedback/${enc(feedbackId)}/dismiss`),
  /** Relative URL of the submitted resume snapshot (the API redirects to the file download). */
  resumeUrl: (submissionId: string) => `${V}/submissions/${enc(submissionId)}/resume`,

  // ---------------------------------------------------------------- consents
  consents: (candidateId: string, signal?: AbortSignal) =>
    api.get<CandidateConsentOut[]>(`${V}/candidates/${enc(candidateId)}/consents`, { signal }),
  requestConsent: (candidateId: string, body: PipelineConsentRequestIn) =>
    api.post<ConsentRequestResult>(`${V}/candidates/${enc(candidateId)}/consent-requests`, body),
  withdrawConsent: (consentId: string) => api.post<CandidateConsentOut>(`${V}/consents/${enc(consentId)}/withdraw`),
};

/**
 * Query keys. Everything that shows a demand's applications (board, list, submissions) shares the
 * `board` prefix so one invalidation refreshes every view of the pipeline.
 */
export const pipelineKeys = {
  all: ["pipeline"] as const,
  config: ["pipeline", "config"] as const,
  settings: ["pipeline", "config", "settings"] as const,
  stages: (withTransitions: boolean) => ["pipeline", "config", "stages", withTransitions] as const,
  reasons: (kind: PipelineReasonKind | null, includeArchived: boolean) =>
    ["pipeline", "config", "reasons", kind, includeArchived] as const,
  questionnaires: (includeArchived: boolean) => ["pipeline", "config", "questionnaires", includeArchived] as const,
  boardAll: ["pipeline", "board"] as const,
  board: (demandId: string) => ["pipeline", "board", demandId] as const,
  boardQuery: (demandId: string, q: string) => ["pipeline", "board", demandId, "board", q] as const,
  list: (demandId: string, filters: { q: string; stageId: string | null }, page: number) =>
    ["pipeline", "board", demandId, "list", filters, page] as const,
  submissions: (demandId: string) => ["pipeline", "board", demandId, "submissions"] as const,
  application: (id: string) => ["pipeline", "application", id] as const,
  applicationDetail: (id: string) => ["pipeline", "application", id, "detail"] as const,
  screenings: (id: string) => ["pipeline", "application", id, "screenings"] as const,
  screeningForm: (id: string, questionnaireId: string | null) =>
    ["pipeline", "application", id, "form", questionnaireId] as const,
  submission: (id: string) => ["pipeline", "submission", id] as const,
  candidate: (candidateId: string) => ["pipeline", "candidate", candidateId] as const,
  consents: (candidateId: string) => ["pipeline", "candidate", candidateId, "consents"] as const,
};
