import { api } from "@/lib/api/client";
import type {
  InterviewCreate,
  InterviewOut,
  InterviewPage,
  InterviewReschedule,
  InterviewSettingsOut,
  InterviewSettingsUpdate,
  InterviewSummaryOut,
  KitCreate,
  KitOut,
  KitUpdate,
  PlanOut,
  PlanStageIn,
  ScorecardDraftIn,
  ScorecardListOut,
  ScorecardOut,
  SelectOut,
  StageOutcomeIn,
  StageOutcomeOut,
  StageTemplateCreate,
  StageTemplateOut,
  StageTemplateUpdate,
} from "./types";

const enc = encodeURIComponent;
const V = "/api/v1";

export type InterviewRange = { from?: string | null; to?: string | null; status?: string | null; page?: number; pageSize?: number };

function rangeQuery(r: InterviewRange): string {
  const p = new URLSearchParams();
  if (r.from) p.set("from", r.from);
  if (r.to) p.set("to", r.to);
  if (r.status) p.set("status", r.status);
  p.set("page", String(r.page ?? 1));
  p.set("page_size", String(r.pageSize ?? 100));
  return p.toString();
}

export type ReasonCode = { id: string; code: string; label: string; kind: string; archived_at?: string | null };

/** Every Epic 7 interview endpoint the internal app calls (the public scorecard page uses `publicScorecardApi`). */
export const interviewsApi = {
  // settings, kits, templates
  settings: (signal?: AbortSignal) => api.get<InterviewSettingsOut>(`${V}/interviews/settings`, { signal }),
  updateSettings: (body: InterviewSettingsUpdate) => api.patch<InterviewSettingsOut>(`${V}/interviews/settings`, body),
  kits: (includeArchived = false, signal?: AbortSignal) =>
    api.get<KitOut[]>(`${V}/interview-kits${includeArchived ? "?include_archived=true" : ""}`, { signal }),
  createKit: (body: KitCreate) => api.post<KitOut>(`${V}/interview-kits`, body),
  updateKit: (id: string, body: KitUpdate) => api.patch<KitOut>(`${V}/interview-kits/${enc(id)}`, body),
  archiveKit: (id: string) => api.post<KitOut>(`${V}/interview-kits/${enc(id)}/archive`),
  templates: (includeArchived = false, signal?: AbortSignal) =>
    api.get<StageTemplateOut[]>(`${V}/interview-stage-templates${includeArchived ? "?include_archived=true" : ""}`, { signal }),
  createTemplate: (body: StageTemplateCreate) => api.post<StageTemplateOut>(`${V}/interview-stage-templates`, body),
  updateTemplate: (id: string, body: StageTemplateUpdate) =>
    api.patch<StageTemplateOut>(`${V}/interview-stage-templates/${enc(id)}`, body),

  // demand plan
  plan: (demandId: string, signal?: AbortSignal) => api.get<PlanOut>(`${V}/demands/${enc(demandId)}/interview-plan`, { signal }),
  savePlan: (demandId: string, stages: PlanStageIn[]) =>
    api.put<PlanOut>(`${V}/demands/${enc(demandId)}/interview-plan`, { stages }),
  applyTemplate: (demandId: string, templateId: string) =>
    api.post<PlanOut>(`${V}/demands/${enc(demandId)}/interview-plan/apply-template`, { template_id: templateId }),

  // interviews
  forDemand: (demandId: string, range: InterviewRange, signal?: AbortSignal) =>
    api.get<InterviewPage>(`${V}/demands/${enc(demandId)}/interviews?${rangeQuery(range)}`, { signal }),
  forApplication: (applicationId: string, signal?: AbortSignal) =>
    api.get<InterviewOut[]>(`${V}/applications/${enc(applicationId)}/interviews`, { signal }),
  mine: (range: InterviewRange, signal?: AbortSignal) => api.get<InterviewPage>(`${V}/me/interviews?${rangeQuery(range)}`, { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<InterviewOut>(`${V}/interviews/${enc(id)}`, { signal }),
  schedule: (applicationId: string, body: InterviewCreate) =>
    api.post<InterviewOut>(`${V}/applications/${enc(applicationId)}/interviews`, body),
  reschedule: (id: string, body: InterviewReschedule) => api.patch<InterviewOut>(`${V}/interviews/${enc(id)}/reschedule`, body),
  cancel: (id: string, reason: string) => api.post<InterviewOut>(`${V}/interviews/${enc(id)}/cancel`, { reason }),
  noShow: (id: string) => api.post<InterviewOut>(`${V}/interviews/${enc(id)}/no-show`),
  complete: (id: string) => api.post<InterviewOut>(`${V}/interviews/${enc(id)}/complete`),
  icsUrl: (id: string, participantId?: string) =>
    `${V}/interviews/${enc(id)}/ics${participantId ? `?participant_id=${enc(participantId)}` : ""}`,

  // scorecards
  myScorecard: (id: string, signal?: AbortSignal) => api.get<ScorecardOut>(`${V}/interviews/${enc(id)}/scorecards/mine`, { signal }),
  saveMyScorecard: (id: string, body: ScorecardDraftIn) =>
    api.put<ScorecardOut>(`${V}/interviews/${enc(id)}/scorecards/mine`, body),
  submitMyScorecard: (id: string, body: ScorecardDraftIn) =>
    api.post<ScorecardOut>(`${V}/interviews/${enc(id)}/scorecards/mine/submit`, body),
  scorecards: (id: string, signal?: AbortSignal) => api.get<ScorecardListOut>(`${V}/interviews/${enc(id)}/scorecards`, { signal }),

  // outcomes
  summary: (applicationId: string, signal?: AbortSignal) =>
    api.get<InterviewSummaryOut>(`${V}/applications/${enc(applicationId)}/interview-summary`, { signal }),
  recordOutcome: (applicationId: string, body: StageOutcomeIn) =>
    api.post<StageOutcomeOut>(`${V}/applications/${enc(applicationId)}/stage-outcomes`, body),
  select: (applicationId: string) => api.post<SelectOut>(`${V}/applications/${enc(applicationId)}/select`),
  rejectReasons: (signal?: AbortSignal) => api.get<ReasonCode[]>(`${V}/pipeline/reason-codes?kind=reject`, { signal }),
};

/**
 * Query keys. `interviews` is the shared root the spec names; mutations also invalidate the Epic 6
 * `application`, `board` and `demand-progress` roots so pipeline views pick up stage moves.
 */
export const interviewKeys = {
  all: ["interviews"] as const,
  settings: ["interviews", "settings"] as const,
  kits: ["interviews", "kits"] as const,
  templates: ["interviews", "templates"] as const,
  plan: (demandId: string) => ["interviews", "plan", demandId] as const,
  demand: (demandId: string, range: InterviewRange) => ["interviews", "demand", demandId, range] as const,
  application: (applicationId: string) => ["interviews", "application", applicationId] as const,
  summary: (applicationId: string) => ["interviews", "summary", applicationId] as const,
  mine: (range: InterviewRange) => ["interviews", "mine", range] as const,
  one: (id: string) => ["interviews", "one", id] as const,
  myScorecard: (id: string) => ["interviews", "scorecard-mine", id] as const,
  scorecards: (id: string) => ["interviews", "scorecards", id] as const,
  rejectReasons: ["interviews", "reject-reasons"] as const,
};

/**
 * Other domains' query roots refreshed after interview mutations: the Epic 6 pipeline (board, application
 * drawer) and the demand detail (pipeline progress counts).
 */
export const PIPELINE_ROOTS: readonly (readonly string[])[] = [["pipeline"], ["demands", "detail"], ["offers"]];
