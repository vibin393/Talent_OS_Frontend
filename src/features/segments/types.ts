/**
 * Hand-written DTOs of the Epic 36 semantic catalogue and the Epic 38 segments endpoints
 * (`app/schemas/segments.py`). Do not regenerate from the OpenAPI schema.
 */

export type SourceKey = "candidates.candidate" | "placements.worker";

/** Any semantic source the builder can edit rules over (segments use `SourceKey`; Epic 43 campus eligibility
 * rules use `campus.registration`, which is not a segment source). */
export type BuilderSourceKey = SourceKey | "campus.registration";

export type FieldType =
  | "string"
  | "int"
  | "decimal"
  | "bool"
  | "date"
  | "datetime"
  | "uuid"
  | "enum"
  | "string_array"
  | "skill";

export type Operator =
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

/** One field of `GET /semantic/sources/{key}`. Fields with empty `ops` are display-only. */
export type SemanticField = {
  key: string;
  label: string;
  type: FieldType;
  pii_class: string;
  ops: string[];
  aggs?: string[];
  groupable?: boolean;
  date_buckets?: boolean | string[] | null;
  enum_values: string[] | null;
  join: string | null;
  displayable?: boolean;
  masked?: boolean;
};

export type SemanticSource = { key: string; label: string; fields: SemanticField[] };

export type SkillRef = { kind: "global" | "tenant"; id: string };
export type SkillMatchValue = { ref: SkillRef; min_proficiency: number | null; expand: boolean; label?: string };
export type WithinDaysValue = number | { days: number; direction: "past" | "future" };

export type ConditionNode = { field: string; op: string; value: unknown };
export type AndNode = { and: FilterNode[] };
export type OrNode = { or: FilterNode[] };
export type FilterNode = ConditionNode | AndNode | OrNode;

export type Definition = { filters: FilterNode | null };

export type Visibility = "private" | "team" | "tenant";

export type RepairIssue = { code: string; message: string; path: string | null };

export type SegmentOut = {
  id: string;
  name: string;
  description: string | null;
  source_key: SourceKey;
  definition: Definition;
  definition_version: number;
  owner_id: string;
  visibility: Visibility;
  team_id: string | null;
  needs_repair: boolean;
  repair_issues: RepairIssue[];
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SegmentCreate = {
  name: string;
  description?: string | null;
  source_key: SourceKey;
  definition: Definition;
  visibility?: Visibility;
  team_id?: string | null;
};

export type SegmentUpdate = Partial<Pick<SegmentCreate, "name" | "description" | "definition" | "visibility" | "team_id">>;

export type SegmentVersion = { version: number; definition: Definition; created_by: string | null; created_at: string };

export type PreviewColumn = { key: string; label: string; type: string; masked: boolean };
export type PreviewRow = { subject_id: string } & Record<string, unknown>;
export type SegmentPreview = { count: number; columns: PreviewColumn[]; rows: PreviewRow[]; masked_fields: string[] };
