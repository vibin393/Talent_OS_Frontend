/**
 * Epic 56 Sourcing Agent DTOs, hand-mirrored from `Backend/app/schemas/sourcing_agent.py` (gen:api is deferred, see
 * `lib/api/agentic-types.ts`).
 */

export type Channel = "email" | "sms" | "whatsapp";
export type SourceKind = "match" | "pool" | "silver_medalist" | "search" | "rediscovery";
export type EntryStatus = "suggested" | "added_to_pipeline" | "dismissed";
export type DraftStatus = "none" | "proposed" | "sent" | "failed" | "suppressed";
export type DismissReason =
  | "not_interested"
  | "skills_gap"
  | "experience"
  | "compensation"
  | "location"
  | "availability"
  | "duplicate"
  | "other";
export type TriggerKey = "demand_opened" | "requirements_changed" | "weekly_refresh" | "manual" | "workflow";

export interface SourceRef {
  kind: SourceKind;
  ref: string | null;
  label: string | null;
}

export interface ChannelState {
  ok: boolean;
  reason: string | null;
}

export interface EntryOut {
  id: string;
  shortlist_id: string;
  demand_id: string;
  candidate_id: string;
  candidate_name: string | null;
  candidate_human_id: string | null;
  current_title: string | null;
  rank: number;
  overall: number | null;
  match_id: string | null;
  sources: SourceRef[];
  explanation: string | null;
  agent_note: string | null;
  flags: string[];
  contactability: Partial<Record<Channel, ChannelState>>;
  best_channel: Channel | null;
  last_activity_at: string | null;
  notice_period_days: number | null;
  availability_date: string | null;
  status: EntryStatus;
  decided_by: string | null;
  decided_at: string | null;
  dismiss_reason: string | null;
  application_id: string | null;
  draft_channel: Channel | null;
  draft_subject: string | null;
  draft_body: string | null;
  draft_status: DraftStatus;
  outreach_proposal_id: string | null;
  outreach_sent_at: string | null;
}

export interface ShortlistOut {
  id: string;
  demand_id: string;
  run_id: string | null;
  version: number;
  status: "current" | "superseded";
  trigger_key: TriggerKey;
  considered_count: number;
  excluded_counts: Record<string, number>;
  suppressed_counts: Record<string, number>;
  top_n: number;
  summary: string | null;
  created_at: string;
  owner_user_id: string | null;
  owner_name: string | null;
  agent_enabled: boolean;
  entries: EntryOut[];
}

export interface ShortlistEnvelope {
  demand_id: string;
  agent_enabled: boolean;
  shortlist: ShortlistOut | null;
}

export interface ShortlistVersionOut {
  id: string;
  version: number;
  status: "current" | "superseded";
  trigger_key: TriggerKey;
  created_at: string;
  entry_count: number;
}

export interface EntryDecisionIn {
  decision: "add_to_pipeline" | "dismiss" | "restore";
  reason?: DismissReason | null;
}

export interface SourcingSettingsOut {
  top_n: number;
  draft_top: number;
  preferred_channel: Channel;
  include_silver_medalists: boolean;
  max_searches: number;
  propose_pipeline_adds: boolean;
  propose_sequence_id: string | null;
  updated_at: string | null;
}

export interface SourcingSettingsIn {
  top_n?: number;
  draft_top?: number;
  preferred_channel?: Channel;
  include_silver_medalists?: boolean;
  max_searches?: number;
  propose_pipeline_adds?: boolean;
  propose_sequence_id?: string | null;
  clear_sequence?: boolean;
}

export interface SourcingRunOut {
  run_id: string | null;
  status: string;
  reason: string | null;
}
