/** Bench management types (Epic 24). Hand-written aliases of `app/schemas/bench*.py`; money is a decimal string. */

export type BenchStatus = "on_bench" | "proposed" | "redeployed" | "released";
export type BenchOrigin = "placement_ended" | "contractor_opt_in" | "manual";
export type ReleaseReason = "resigned" | "terminated" | "contractor_unavailable" | "other";
export type ReviewDecision = "reviewed" | "dismissed";

export type SkillRef = { skill_id: string | null; tenant_skill_id: string | null; name: string };

export type BenchEntryOut = {
  id: string;
  candidate_id: string;
  candidate_name: string | null;
  candidate_human_id: string | null;
  source_placement_id: string | null;
  legal_entity_id: string | null;
  status: BenchStatus;
  origin: BenchOrigin;
  available_from: string;
  skills: SkillRef[];
  location: { city?: string; state?: string; country?: string } | null;
  work_authorization: string | null;
  preferred_locations: string[];
  bench_days: number;
  cost_per_day: string | null;
  cost_to_date: string | null;
  cost_currency: string | null;
  cost_source: string | null;
  cost_rate_unit_basis: string | null;
  cost_unknown: boolean;
  cost_masked: boolean;
  proposed_application_ids: string[];
  proposed_count: number;
  redeployed_placement_id: string | null;
  released_reason: ReleaseReason | null;
  released_note: string | null;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BenchEntryPage = { items: BenchEntryOut[]; total: number; page: number; page_size: number };

export type BenchEntryCreate = {
  candidate_id: string;
  available_from: string;
  notes?: string | null;
  work_authorization?: string | null;
};

export type BenchEntryUpdate = {
  notes?: string | null;
  work_authorization?: string | null;
  available_from?: string | null;
  refresh_skills?: boolean;
};

export type BenchMatchItem = {
  candidate: { id: string; human_id: string | null; display_name: string | null; current_title: string | null; city: string | null };
  pool: "bench" | "rolling_off";
  match_id: string | null;
  overall: number | null;
  sub_scores: Record<string, number | null>;
  explanation: string | null;
  dismissed_at: string | null;
  application_id: string | null;
  score_pending: boolean;
  score_unavailable_reason: "no_consent" | null;
  strong: boolean;
  bench_entry_id: string | null;
  bench_status: BenchStatus | null;
  bench_days: number | null;
  available_from: string | null;
  rolling_off_end_date: string | null;
  cost_per_day: string | null;
  cost_currency: string | null;
  cost_masked: boolean;
  review_decision: ReviewDecision | null;
  review_reason: string | null;
};

export type BenchMatchesOut = {
  demand_id: string;
  strong_threshold: number;
  items: BenchMatchItem[];
  unreviewed_strong: number;
  reviewed_complete: boolean;
  completed_at: string | null;
};

export type MoneyByCurrency = { currency: string; amount: string | null };
export type MonthCost = { month: string; currency: string; amount: string | null };

export type BenchSummaryOut = {
  as_of: string;
  count_on_bench: number;
  avg_bench_days: string | null;
  bench_days_by_worker: { bench_entry_id: string; candidate_id: string; candidate_name: string | null; status: BenchStatus; bench_days: number }[];
  total_cost_to_date: MoneyByCurrency[];
  cost_by_month: MonthCost[];
  upcoming_roll_offs_30: number;
  upcoming_roll_offs_60: number;
  redeployment_rate: string | null;
  redeployed: number;
  released: number;
  masked: boolean;
  filters: Record<string, Record<string, unknown>>;
};

export type RollOffRow = {
  placement_id: string;
  placement_human_id: string;
  candidate_id: string;
  candidate_name: string | null;
  client_id: string;
  client_name: string | null;
  role_title: string | null;
  end_date: string;
  days_left: number;
};

export type WorkerBenchOut = {
  id: string;
  status: BenchStatus;
  origin: BenchOrigin;
  available_from: string;
  work_authorization: string | null;
  preferred_locations: string[];
};

export type WorkerBenchState = { entry: WorkerBenchOut | null; can_opt_in: boolean; can_opt_out: boolean };

export type OptInIn = { available_from: string; work_authorization: string | null; preferred_locations: string[] };
