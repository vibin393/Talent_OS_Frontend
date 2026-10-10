/**
 * Epic 49 (Bias Audit & Adverse-Impact Reporting): hand-written API types (see the Epic 49 API contract).
 * Decimal values arrive as JSON strings; dates are `YYYY-MM-DD`, datetimes ISO.
 */

export type DimensionKey = "gender" | "age_band" | "disability";

export type OptionOut = { key: string; label: string };

export type DimensionOut = { key: DimensionKey; label: string; enabled: boolean; position: number; options: OptionOut[] };

export type NoticeOut = { id: string; version: number; title: string; text: string };

export type SelfIdAnswers = Partial<Record<DimensionKey, string>>;

// ---------------------------------------------------------------- settings

export type CategorySetOut = { id: string; version: number; dimensions: DimensionOut[] };

export type FairnessSettingsOut = {
  self_id_enabled: boolean;
  self_id_on_apply: boolean;
  self_id_in_portal: boolean;
  k: number;
  ll144_enabled: boolean;
  ll144_notice_text: string | null;
  alternative_process_text: string | null;
  data_retention_text: string | null;
  qualifications_text: string | null;
  notice_lead_business_days: number;
  category_set: CategorySetOut;
};

export type FairnessSettingsPatch = Partial<Omit<FairnessSettingsOut, "category_set">>;

export type CategorySetIn = {
  dimensions: { key: DimensionKey; label: string; enabled: boolean; options: OptionOut[] }[];
};

// ---------------------------------------------------------------- runs

export type SelectionPoint =
  | "stage_transition"
  | "ai_match_threshold"
  | "ai_screening_pass"
  | "assessment_pass"
  // Epic 65: agent selection points (`GET /fairness/selection-points`, hidden when `available=false`).
  | "agent_shortlist_added"
  | "agent_screening_flag_advanced"
  | "agent_draft_rating_accepted";
export type Intersection = "gender×age_band" | "gender×disability";
export type RunStatus = "queued" | "running" | "completed" | "failed";
export type RunMethod = "selection_rate" | "scoring_rate" | "both";

export type RunParams = {
  from_stage_key?: string | null;
  to_stage_key?: string | null;
  min_score?: number | null;
  assessment_id?: string | null;
  /** Epic 65: screening flag source. */
  source?: "text" | "voice" | "both" | null;
  /** Epic 65: Interview Assistant drafts, minimum accepted share (0..1). */
  min_accepted_share?: number | null;
};

export type RunFilters = { demand_ids?: string[]; client_id?: string | null; job_category?: string | null };

export type RunCreate = {
  selection_point: SelectionPoint;
  params: RunParams;
  date_from: string;
  date_to: string;
  filters: RunFilters;
  intersections: Intersection[];
};

export type RunSummaryOut = {
  id: string;
  selection_point: SelectionPoint;
  params: Record<string, unknown>;
  date_from: string;
  date_to: string;
  k: number;
  method: RunMethod;
  status: RunStatus;
  total_applicants: number | null;
  created_at: string;
  completed_at: string | null;
  error_code: string | null;
};

/** A number, or a string such as "<5" when suppressed. */
export type Cell = number | string;

export type SnapshotRow = {
  category: string;
  label: string;
  unknown: boolean;
  suppressed: boolean;
  applicants: Cell;
  selected: Cell;
  rate: string | null;
  impact_ratio: string | null;
  flag: boolean | null;
  scoring_rate?: string | null;
  scoring_impact_ratio?: string | null;
  scoring_flag?: boolean | null;
};

export type SnapshotTable = {
  key: string;
  dimensions: DimensionKey[];
  rows: SnapshotRow[];
  totals: { applicants: number; selected: number };
};

export type Snapshot = {
  category_set_version: number;
  k: number;
  suppressed_label: string;
  method: string;
  median_score: string | null;
  tables: SnapshotTable[];
  notes: string[];
};

export type PackFileOut = { name: string; kind: "pdf" | "csv"; url: string };
export type PackOut = { run_id: string; aedt_id: string; generated_at: string; expires_at: string; files: PackFileOut[] };

export type RunOut = RunSummaryOut & {
  filters: Record<string, unknown>;
  intersections: string[];
  snapshot: Snapshot | null;
  unknown_counts: Record<string, number> | null;
  pack: PackOut | null;
};

// ---------------------------------------------------------------- AEDT inventory

export type AedtFeature =
  | "ai_match"
  | "ai_screening"
  | "assessment_autoscore"
  | "other"
  // Epic 65: agent inventory entries (seeded inactive, never used to filter).
  | "agent_sourcing"
  | "agent_screening"
  | "agent_voice_screening"
  | "agent_interview_assist";
export type AedtStatus = "active" | "retired" | "inactive";

export type AedtIn = {
  feature: AedtFeature;
  name: string;
  version: string | null;
  first_used_on: string | null;
  data_used: string | null;
  job_categories: string[];
  used_to_filter: boolean;
  status: AedtStatus;
  notes: string | null;
};

export type AedtOut = AedtIn & { id: string; created_at: string; updated_at: string };

// ---------------------------------------------------------------- publications

export type PublicSummaryRow = {
  category: string;
  label: string;
  unknown: boolean;
  applicants: Cell;
  impact_ratio: string | null;
  scoring_impact_ratio?: string | null;
};

export type PublicSummary = {
  selection_point: string;
  date_from: string;
  date_to: string;
  total_applicants: number;
  unknown_counts: Record<string, number>;
  tables: { key: string; rows: PublicSummaryRow[] }[];
};

export type PublicationOut = {
  id: string;
  run_id: string;
  aedt_id: string;
  aedt_name: string;
  audit_date: string;
  distribution_date: string;
  summary: PublicSummary;
  published_at: string;
  unpublished_at: string | null;
};

export type PublicationCreate = { run_id: string; aedt_id: string; audit_date: string; distribution_date: string };

export type PublicPublicationOut = {
  id: string;
  aedt_name: string;
  feature: string;
  audit_date: string;
  distribution_date: string;
  summary: PublicSummary;
};

// ---------------------------------------------------------------- LL144

export type Ll144FlagOut = {
  demand_id: string;
  flagged: boolean;
  jurisdiction: "nyc" | null;
  notice_published_at: string | null;
  notice_period_ends_at: string | null;
  in_notice_period: boolean;
  ll144_enabled: boolean;
};

export type AlternativeRequestOut = {
  id: string;
  application_id: string;
  demand_id: string;
  channel: "apply" | "portal";
  note: string | null;
  task_id: string | null;
  requested_at: string;
  status: "open" | "handled";
};

export type PublicNoticeOut = {
  applies: boolean;
  notice_text: string | null;
  qualifications_text: string | null;
  data_retention_text: string | null;
  alternative_process_text: string | null;
  aedts: { name: string; feature: string; version: string | null; data_used: string | null }[];
};

// ---------------------------------------------------------------- self-ID

export type SelfIdFormOut = { enabled: boolean; notice: NoticeOut | null; dimensions: DimensionOut[] };

export type SelfIdOut = SelfIdFormOut & { answers: SelfIdAnswers | null };

export type SelfIdIn = { notice_id: string; answers: SelfIdAnswers };

export type ScoreHiddenReason = "alternative_process" | "notice_period";
