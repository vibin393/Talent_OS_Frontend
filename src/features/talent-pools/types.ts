/**
 * Hand-written DTOs of the Epic 38 talent pool endpoints (`app/schemas/talent_pools.py`).
 * Do not regenerate from the OpenAPI schema. Decimals are strings.
 */
import type { Definition, SourceKey, Visibility } from "@/features/segments/types";

export type PoolKind = "static" | "dynamic";
export type PoolStatus = "active" | "archived";
export type PoolFilter = "all" | "mine" | "team" | "tenant";

export type PoolOut = {
  id: string;
  name: string;
  description: string | null;
  kind: PoolKind;
  segment_id: string | null;
  segment_name: string | null;
  source_key: SourceKey | null;
  owner_id: string;
  owner_name: string | null;
  visibility: Visibility;
  team_id: string | null;
  status: PoolStatus;
  archived_at: string | null;
  template_key: string | null;
  legacy_list_id: string | null;
  member_count: number;
  last_refreshed_at: string | null;
  last_diff: { added: number; removed: number } | null;
  needs_repair: boolean;
  subscribed: boolean;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
};

export type PoolListParams = {
  filter?: PoolFilter;
  kind?: PoolKind;
  include_archived?: boolean;
  q?: string;
};

export type PoolCreate = {
  name: string;
  description?: string | null;
  kind: PoolKind;
  visibility?: Visibility;
  team_id?: string | null;
  segment_id?: string | null;
  segment?: { source_key: SourceKey; definition: Definition };
};

export type PoolUpdate = { name?: string; description?: string | null; visibility?: Visibility; team_id?: string | null };

export type MemberSource = "manual" | "segment" | "legacy_list" | "workflow";
export type ConsentState = "granted" | "withdrawn" | "none";

export type MemberReason = {
  segment_id?: string;
  version?: number;
  matched?: { field: string; op: string; label: string }[];
  skills?: { skill_key: string; weight: string | number }[];
  added_by?: string | null;
  note?: string | null;
};

export type PoolMember = {
  candidate_id: string;
  full_name: string;
  current_title: string | null;
  source: MemberSource;
  reason: MemberReason | null;
  added_at: string;
  added_by: string | null;
  consent_marketing: ConsentState;
  consent_engagement: ConsentState;
};

export type MemberPage = { items: PoolMember[]; total: number; page: number; page_size: number };
export type AddMembersOut = { added: number; existing: number; member_count: number };

export type RefreshTrigger = "nightly" | "manual" | "skill_graph" | "created";
export type RefreshStatus = "running" | "done" | "failed" | "skipped_needs_repair";

export type RefreshOut = {
  id: string;
  pool_id: string;
  trigger: RefreshTrigger;
  status: RefreshStatus;
  added: number;
  removed: number;
  evaluated: number | null;
  duration_ms: number | null;
  error_code: string | null;
  started_at: string;
  finished_at: string | null;
};

export type PoolTemplate = {
  key: string;
  name: string;
  description: string | null;
  source_key: SourceKey;
  enabled: boolean;
  available: boolean;
  unavailable_reason: string | null;
  pool_id: string | null;
};

// Demand integration ---------------------------------------------------------------------------------

export type RediscoveryPoolTop = { candidate_id: string; full_name: string; overall: string; rank: number };
export type RediscoveryPool = {
  pool_id: string;
  name: string;
  kind: PoolKind;
  pinned: boolean;
  matching_count: number;
  top: RediscoveryPoolTop[];
};
export type RediscoveryPoolsSection = { matching_pools: number; summary: string; pools: RediscoveryPool[] };
export type RediscoveryOut = {
  funnel: Record<string, unknown> | null;
  sections: { pools?: RediscoveryPoolsSection | null } & Record<string, unknown>;
};

export type PoolPin = {
  pool_id: string;
  name: string;
  kind: PoolKind;
  member_count: number;
  pinned_by: string | null;
  pinned_at: string;
};

export type PipelineAddItem = {
  candidate_id: string;
  status: "created" | "exists" | "error";
  application_id: string | null;
  existing_application_id: string | null;
  error: string | null;
};
export type PipelineAddOut = { items: PipelineAddItem[]; counts: Record<string, number> };
