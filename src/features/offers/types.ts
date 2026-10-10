// Epic 8 API types, aliased from the generated OpenAPI schema (`npm run gen:api`). Ambiguous component names
// (merge fields, money) are resolved through `paths` / owning models so regenerated names only matter here.
import type { components, paths } from "@/lib/api/schema";

type S = components["schemas"];
type Json<T> = T extends { content: { "application/json": infer B } } ? B : never;

export type OfferOut = S["OfferOut"];
export type OfferDetailOut = S["OfferDetailOut"];
export type OfferVersionOut = S["OfferVersionOut"];
export type OfferVersionBrief = S["OfferVersionBrief"];
export type OfferStatus = OfferOut["status"];
export type OfferStatusHistoryOut = S["OfferStatusHistoryOut"];
export type OfferResponseOut = S["OfferResponseOut"];
export type OfferCreate = S["OfferCreate"];
export type OfferUpdate = S["OfferUpdate"];
export type EmploymentType = OfferVersionOut["employment_type"];
export type WorkMode = NonNullable<OfferVersionOut["work_mode"]>;
export type RateUnit = OfferVersionOut["pay_rate_unit"];
export type Money = OfferVersionOut["pay_rate"];
export type MoneyIn = NonNullable<OfferUpdate["pay_rate"]>;

export type OfferSettingsOut = S["OfferSettingsOut"];
export type OfferSettingsUpdate = S["OfferSettingsUpdate"];
export type OfferTemplateOut = S["OfferTemplateOut"];
export type OfferTemplateIn = S["OfferTemplateIn"];
export type OfferTemplateUpdate = S["OfferTemplateUpdate"];
export type MergeFieldOut = Json<paths["/api/v1/offer-templates/merge-fields"]["get"]["responses"][200]>[number];

export type ApprovalRequest = OfferDetailOut["approvals"][number];
export type ApprovalDecision = NonNullable<ApprovalRequest["decisions"]>[number];

export type CandidateOfferView = S["CandidateOfferView"];
export type OfferActionOut = S["OfferActionOut"];
export type AcceptIn = S["AcceptIn"];
export type DeclineIn = S["DeclineIn"];

export type OfferPage = { items: OfferOut[]; total: number; page: number; page_size: number };
