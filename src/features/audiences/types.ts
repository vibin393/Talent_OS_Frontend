/**
 * Hand-written DTOs of the Epic 39 audience endpoints (`app/schemas/campaigns.py`).
 * Do not regenerate from the OpenAPI schema.
 */

export type SourceMode = "include" | "exclude";
export type SourceKind = "pool" | "segment";
export type AudienceStatus = "draft" | "active" | "archived";

export type AudienceSourceIn = {
  mode: SourceMode;
  kind: SourceKind;
  talent_pool_id?: string | null;
  segment_id?: string | null;
};

export type AudienceSourceOut = {
  id: string;
  mode: SourceMode;
  kind: SourceKind;
  talent_pool_id: string | null;
  segment_id: string | null;
  name: string | null;
};

export type AudienceCreate = { name: string; description?: string | null; sources?: AudienceSourceIn[] };
export type AudienceUpdate = {
  name?: string;
  description?: string | null;
  status?: "draft" | "active";
  sources?: AudienceSourceIn[];
};

export type AudienceOut = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  status: AudienceStatus;
  version: number;
  sources: AudienceSourceOut[];
  include_list_count: number;
  exclude_list_count: number;
  created_at: string;
  updated_at: string;
};

export type ListImportRow = { row: number; value: string; candidate_id: string | null };

export type ListImportOut = {
  mode: SourceMode;
  applied: boolean;
  matched: number;
  unmatched: number;
  matched_rows: ListImportRow[];
  unmatched_rows: ListImportRow[];
};

export type AudiencePreviewOut = {
  audience_id: string;
  total: number;
  reachable: Record<string, number>;
  suppressed: Record<string, Record<string, number>>;
  elapsed_ms: number;
};
