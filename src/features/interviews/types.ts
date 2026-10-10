// Epic 7 API types, aliased from the generated OpenAPI schema (`npm run gen:api`). Kept beside the feature so
// regenerated names only need re-mapping here. Ambiguous component names are resolved through `paths`.
import type { components, paths } from "@/lib/api/schema";

type S = components["schemas"];
type Json<T> = T extends { content: { "application/json": infer B } } ? B : never;

export type InterviewOut = S["InterviewOut"];
export type ParticipantOut = S["ParticipantOut"];
export type InterviewStatus = InterviewOut["status"];
export type InterviewMode = InterviewOut["mode"];
export type ParticipantKind = ParticipantOut["kind"];
export type InterviewCreate = S["InterviewCreate"];
export type InterviewReschedule = S["InterviewReschedule"];
export type ParticipantIn = S["ParticipantIn"];

export type PlanOut = S["PlanOut"];
export type PlanStageOut = S["PlanStageOut"];
export type PlanStageIn = S["PlanStageIn"];
export type StageKind = PlanStageOut["kind"];

export type KitOut = S["KitOut"];
export type KitCreate = S["KitCreate"];
export type KitUpdate = S["KitUpdate"];
export type Competency = S["Competency"];
export type KitQuestion = S["KitQuestion"];

export type StageTemplateOut = Json<paths["/api/v1/interview-stage-templates"]["get"]["responses"][200]>[number];
export type StageTemplateCreate = Json<paths["/api/v1/interview-stage-templates"]["post"]["requestBody"]>;
export type StageTemplateUpdate = Json<NonNullable<paths["/api/v1/interview-stage-templates/{template_id}"]["patch"]["requestBody"]>>;
export type TemplateStage = S["TemplateStage"];

export type InterviewSettingsOut = S["InterviewSettingsOut"];
export type InterviewSettingsUpdate = S["InterviewSettingsUpdate"];

export type ScorecardOut = S["ScorecardOut"];
export type ScorecardListOut = S["ScorecardListOut"];
export type ScorecardDraftIn = S["ScorecardDraftIn"];
export type Recommendation = NonNullable<ScorecardDraftIn["recommendation"]>;
export type RatingIn = NonNullable<ScorecardDraftIn["ratings"]>[number];
export type AnswerIn = NonNullable<ScorecardDraftIn["answers"]>[number];

export type StageOutcomeIn = S["StageOutcomeIn"];
export type StageOutcomeOut = S["StageOutcomeOut"];
export type InterviewSummaryOut = S["InterviewSummaryOut"];
export type StageSummaryOut = S["StageSummaryOut"];
export type SelectOut = S["SelectOut"];

export type PublicScorecardView = S["PublicScorecardView"];
export type PublicScorecardIn = S["PublicScorecardIn"];

export type InterviewPage = { items: InterviewOut[]; total: number; page: number; page_size: number };
