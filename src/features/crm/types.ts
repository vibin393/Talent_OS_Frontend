/**
 * Sales CRM API types (Epic 15), hand-written to mirror `Backend/app/schemas/crm.py`.
 * Money / decimal fields are strings (AD-12); ids are UUID strings; dates are ISO strings.
 */

export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "disqualified";
export type OpportunityStage = "qualification" | "proposal" | "negotiation" | "won" | "lost";
export type Service = "contract_staffing" | "permanent_placement" | "project" | "other";
export type ReasonKind = "lead_disqualify" | "opportunity_lost" | "reopen";
export type RecordKind = "client" | "contract" | "rate_card" | "demand";
export type RateUnit = "hour" | "day" | "month" | "year";
export type ContractType = "msa" | "sow";

// ---------------------------------------------------------------- settings / codes / sources
export type CrmSettingsOut = { stage_probabilities: Record<string, number>; default_currency: string };
export type CrmSettingsUpdate = {
  stage_probabilities?: Partial<Record<OpportunityStage, number>> | null;
  default_currency?: string | null;
};

export type ReasonCodeOut = { id: string; kind: ReasonKind; code: string; label: string; archived_at: string | null };
export type ReasonCodeIn = { kind: ReasonKind; code: string; label: string };
export type ReasonCodeUpdate = { label?: string | null; archived?: boolean | null };

export type LeadSourceOut = { id: string; code: string; label: string; archived_at: string | null };
export type LeadSourceIn = { code: string; label: string };
export type LeadSourceUpdate = { label?: string | null; archived?: boolean | null };

// ---------------------------------------------------------------- leads
export type EstimatedRole = { title: string; positions: number };

export type LeadFields = {
  website?: string | null;
  gstin?: string | null;
  industry?: string | null;
  location?: string | null;
  contact_name?: string | null;
  contact_title?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  source_code?: string | null;
  estimated_roles?: EstimatedRole[] | null;
  estimated_positions?: number | null;
  expected_annual_revenue?: string | null;
  currency?: string | null;
  owner_id?: string | null;
};

export type LeadCreate = LeadFields & { company_name: string; acknowledge_duplicates?: boolean };
export type LeadUpdate = LeadFields & { company_name?: string | null; acknowledge_duplicates?: boolean };

export type DuplicateCheckIn = {
  company_name: string;
  website?: string | null;
  gstin?: string | null;
  exclude_lead_id?: string | null;
};

export type DuplicateMatch = {
  kind: "client" | "lead";
  id: string;
  name: string;
  reason: "name" | "similar_name" | "domain" | "gstin";
  human_id?: string | null;
};

export type UserRef = { id: string; name: string };

export type LeadOut = {
  id: string;
  human_id: string;
  company_name: string;
  website: string | null;
  website_domain: string | null;
  gstin: string | null;
  industry: string | null;
  location: string | null;
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  source_code: string | null;
  estimated_roles: Array<Record<string, unknown>>;
  estimated_positions: number | null;
  expected_annual_revenue: string | null;
  currency: string;
  owner_id: string;
  owner: UserRef | null;
  status: LeadStatus;
  disqualify_reason_code: string | null;
  disqualify_note: string | null;
  converted_at: string | null;
  converted_opportunity_id: string | null;
  converted_client_id: string | null;
  converted_contact_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadPage = { items: LeadOut[]; total: number; page: number; page_size: number };

export type LeadTransitionIn = { to: LeadStatus; reason_code?: string | null; note?: string | null };

export type StatusHistoryOut = {
  id: string;
  from_value: string | null;
  to_value: string;
  actor_kind: string;
  actor_id: string | null;
  reason_code: string | null;
  note: string | null;
  competitor: string | null;
  at: string;
};

// ---------------------------------------------------------------- import
export type ImportErrorRow = { row: number; field: string | null; code: string };
export type LeadImportOut = {
  batch_id: string;
  status: "queued" | "running" | "completed" | "failed";
  row_count: number;
  created: number;
  skipped_duplicates: number;
  errors: ImportErrorRow[];
  duplicate_of?: string | null;
};

// ---------------------------------------------------------------- opportunities
export type OpportunityLineIn = {
  title: string;
  positions?: number;
  expected_bill_rate?: string | null;
  currency?: string | null;
  rate_unit?: RateUnit | null;
  location?: string | null;
  experience_min_years?: string | null;
  experience_max_years?: string | null;
};

export type OpportunityLineOut = {
  id: string;
  title: string;
  positions: number;
  expected_bill_rate: string | null;
  currency: string;
  rate_unit: string | null;
  location: string | null;
  experience_min_years: string | null;
  experience_max_years: string | null;
  position: number;
};

export type OpportunityCreate = {
  name: string;
  client_id?: string | null;
  primary_contact_id?: string | null;
  service?: Service;
  estimated_revenue?: string;
  currency?: string | null;
  expected_close_date?: string | null;
  owner_id?: string | null;
  account_manager_id?: string | null;
  probability_pct?: string | null;
  lines?: OpportunityLineIn[];
};

export type OpportunityUpdate = Partial<
  Pick<
    OpportunityCreate,
    | "name"
    | "primary_contact_id"
    | "service"
    | "estimated_revenue"
    | "currency"
    | "expected_close_date"
    | "owner_id"
    | "account_manager_id"
    | "probability_pct"
  >
>;

export type OpportunityTransitionIn = {
  to: OpportunityStage;
  expected_stage: OpportunityStage;
  reason_code?: string | null;
  competitor?: string | null;
  note?: string | null;
};

export type OpportunityOut = {
  id: string;
  human_id: string;
  name: string;
  client_id: string;
  client_name: string | null;
  primary_contact_id: string | null;
  lead_id: string | null;
  service: Service;
  estimated_revenue: string;
  weighted_revenue: string;
  currency: string;
  probability_pct: string;
  probability_overridden: boolean;
  expected_close_date: string | null;
  owner_id: string;
  owner: UserRef | null;
  account_manager_id: string | null;
  account_manager: UserRef | null;
  stage: OpportunityStage;
  stage_entered_at: string;
  lost_reason_code: string | null;
  lost_competitor: string | null;
  lost_note: string | null;
  won_at: string | null;
  lost_at: string | null;
  version: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  lines: OpportunityLineOut[];
};

export type OpportunityPage = { items: OpportunityOut[]; total: number; page: number; page_size: number };

export type CurrencyTotal = { currency: string; estimated: string; weighted: string };
export type BoardColumn = { stage: OpportunityStage; count: number; totals: CurrencyTotal[]; items: OpportunityOut[] };
export type BoardOut = { columns: BoardColumn[] };

export type SummaryGroupBy = "owner" | "stage" | "close_month";
export type SummaryGroup = { key: string; label: string; count: number; totals: CurrencyTotal[] };
export type SummaryOut = { group_by: SummaryGroupBy; groups: SummaryGroup[] };

export type ClientOpportunitiesOut = { open_count: number; weighted_pipeline: CurrencyTotal[]; items: OpportunityOut[] };

// ---------------------------------------------------------------- lead conversion
export type ConvertClient =
  | { mode: "link"; client_id: string }
  | { mode: "create"; name: string; website?: string | null; industry?: string | null; gstin?: string | null; owner_id?: string | null };

export type ConvertContact =
  | { mode: "link"; contact_id: string }
  | { mode: "create"; first_name: string; last_name?: string | null; email?: string | null; phone?: string | null; title?: string | null }
  | { mode: "none" };

export type LeadConvertIn = { client: ConvertClient; contact: ConvertContact; opportunity: OpportunityCreate };
export type LeadConvertOut = { lead: LeadOut; opportunity: OpportunityOut; client_id: string; contact_id: string | null };

// ---------------------------------------------------------------- Won conversion
export type WonPreviewOut = {
  opportunity_id: string;
  client: { id: string; name: string; current_status: string; will_activate: boolean };
  contract: { type: ContractType; title: string; legal_entity_id: string | null; start_date: string };
  legal_entities: { id: string; name: string }[];
  rate_card_templates: { id: string; name: string }[];
  demands: WonPreviewDemand[];
  commercials_available: boolean;
};

export type WonPreviewDemand = {
  line_id: string;
  title: string;
  positions: number;
  bill_rate: string | null;
  currency: string;
  rate_unit: string | null;
  location: string | null;
  owner_id: string | null;
};

export type WinContractIn = {
  create: boolean;
  type: ContractType;
  title?: string | null;
  legal_entity_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  parent_contract_id?: string | null;
  file_ids: string[];
};

export type WinDemandOverrides = { title?: string | null; positions?: number | null; location?: string | null; bill_rate?: string | null };

export type WinIn = {
  activate_client: boolean;
  contract: WinContractIn | null;
  rate_card: { template_id: string; effective_from: string } | null;
  demands: { line_id: string; create: boolean; overrides?: WinDemandOverrides | null }[];
};

export type CreatedRecord = { kind: RecordKind; id: string; label?: string | null; line_id?: string | null };

export type WinOut = {
  opportunity: OpportunityOut;
  client_id: string;
  client_activated: boolean;
  contract_id: string | null;
  rate_card_id: string | null;
  demand_ids: string[];
  records: CreatedRecord[];
};

export type RecordLinkOut = { opportunity_id: string; human_id: string; name: string };

// ---------------------------------------------------------------- dashboard
export type StageAmount = { stage: string; count: number; totals: CurrencyTotal[] };
export type MonthAmount = { month: string; count: number; totals: CurrencyTotal[] };

export type DashboardOut = {
  from_date: string;
  to_date: string;
  pipeline: { link: string; by_stage: StageAmount[]; by_close_month: MonthAmount[] };
  closing_this_month: { link: string; count: number; totals: CurrencyTotal[] };
  win_rate: { link: string; won: number; lost: number; win_rate_pct: string | null; avg_sales_cycle_days: string | null };
  leads_by_source: {
    link: string;
    rows: { source_code: string; created: number; converted: number; conversion_rate_pct: string | null }[];
  };
  overdue_tasks: { link: string; count: number };
};
