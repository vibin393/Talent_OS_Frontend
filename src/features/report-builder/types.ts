/**
 * Custom report builder (Epic 47) -- hand-written API types (mirrors `app/schemas/report_builder.py` and the
 * foundation semantic DTOs). There is no free-text expression anywhere: a definition only names registered keys.
 */

export type FieldType = "string" | "int" | "decimal" | "bool" | "date" | "datetime" | "uuid" | "enum" | "string_array" | "skill";
export type Op =
  | "eq"
  | "ne"
  | "in"
  | "not_in"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "between"
  | "contains"
  | "starts_with"
  | "is_null"
  | "within_days"
  | "skill_match";
export type Agg = "count" | "count_distinct" | "sum" | "avg" | "min" | "max" | "ratio" | "pct_of_total";
export type Bucket = "day" | "week" | "month" | "quarter" | "fy";
export type VizType = "table" | "pivot" | "bar" | "line" | "pie" | "kpi";
export type ExportFormat = "xlsx" | "csv" | "pdf";

/** Foundation catalogue (`GET /semantic/sources[/{key}]`). */
export type FieldCatalog = {
  key: string;
  label: string;
  type: FieldType;
  pii_class: string;
  ops: Op[];
  aggs: Agg[];
  groupable: boolean;
  date_buckets: boolean;
  enum_values: string[] | null;
  join: string | null;
  displayable: boolean;
  masked: boolean;
};
export type SourceCatalog = { key: string; label: string; fields: FieldCatalog[] };

/** Foundation `Definition` (filter nodes use `and` / `or` keys). */
export type Condition = { field: string; op: Op; value?: unknown };
export type AndNode = { and: FilterNode[] };
export type OrNode = { or: FilterNode[] };
export type FilterNode = Condition | AndNode | OrNode;
export type GroupBy = { field: string; bucket?: Bucket | null };
export type Measure = { key: string; agg: Agg; field?: string | null; of?: [string, string] | null };
export type SortSpec = { key: string; desc?: boolean };
export type Definition = {
  definition_version?: 1;
  source: string;
  filters?: FilterNode | null;
  fields?: string[];
  group_by?: GroupBy[];
  measures?: Measure[];
  sort?: SortSpec[];
};

export type VizSpec = { type: VizType; x?: string | null; series?: string | null; value?: string | null };

export type ShareTarget = { target_kind: "team" | "role" | "tenant"; team_id?: string | null; role_id?: string | null };
export type ShareOut = ShareTarget & { name: string | null };
export type RepairIssue = { path: string; field: string | null; reason: string };

export type ReportOut = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  owner_name: string | null;
  source_key: string;
  source_label: string | null;
  definition: Definition;
  definition_version: number;
  viz: VizSpec;
  visibility: "private" | "shared";
  status: "ok" | "needs_repair";
  repair_issues: RepairIssue[];
  shares: ShareOut[];
  schedule_count: number;
  pinned: boolean;
  is_owner: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
};
export type ReportIn = { name: string; description?: string | null; definition: Definition; viz: VizSpec };
export type ReportPatch = Partial<ReportIn>;
export type Page<T> = { items: T[]; total: number; page: number; page_size: number };

export type ColumnOut = { key: string; label: string; type: string; masked: boolean };
export type LimitHit = { kind: "row_cap" | "timeout"; message: string };
export type Row = Record<string, string | number | boolean | null>;
export type RunResult = {
  run_id: string | null;
  report_id: string | null;
  definition_version: number | null;
  columns: ColumnOut[];
  rows: Row[];
  total: number | null;
  truncated: boolean;
  row_limit: number;
  masked_fields: string[];
  limit_hit: LimitHit | null;
  viz: VizSpec;
};
export type ExportOut = {
  run_id: string;
  mode: "sync" | "async";
  status: string;
  format: ExportFormat;
  row_count: number | null;
  masked_fields: string[];
  limit_hit: LimitHit | null;
  download_url: string | null;
};

export type PinOut = { report_id: string; name: string; position: number; viz: VizSpec; status: string; definition_version: number };

export type Cadence = "daily" | "weekly" | "monthly";
export type ScheduleIn = {
  report_id: string;
  cadence: Cadence;
  weekday?: number | null;
  month_day?: number | null;
  local_time: string; // HH:MM:SS
  timezone: string;
  format: ExportFormat;
  recipient_user_ids: string[];
};
export type ScheduleOut = Omit<ScheduleIn, "weekday" | "month_day"> & {
  id: string;
  report_name: string | null;
  owner_id: string;
  weekday: number | null;
  month_day: number | null;
  status: "active" | "paused";
  paused_reason: string | null;
  consecutive_failures: number;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
};
export type ScheduleUpdate = Partial<Omit<ScheduleIn, "report_id">> & { status?: "active" | "paused" };

export type RunLogOut = {
  id: string;
  report_id: string | null;
  report_name: string | null;
  source_key: string;
  definition_version: number | null;
  schedule_id: string | null;
  slot_at: string | null;
  run_kind: "preview" | "run" | "export" | "scheduled";
  principal_user_id: string;
  principal_name: string | null;
  status: string;
  limit_kind: string | null;
  skip_reason: string | null;
  error_code: string | null;
  row_count: number | null;
  duration_ms: number | null;
  masked_fields: string[];
  format: string | null;
  delivery: string;
  expires_at: string | null;
  started_at: string;
  finished_at: string | null;
};
export type RunLogFilters = { report_id?: string; status?: string; run_kind?: string };
