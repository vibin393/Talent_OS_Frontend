/**
 * Epic 55 Demand Agent DTOs, hand-mirrored from `app/schemas/demand_intake.py` and `app/schemas/demand_insights.py`
 * (no `gen:api` regeneration in Phase 4, see `lib/api/agentic-types.ts`).
 */

export type IntakeMode = "off" | "connected_mailbox" | "platform_address";
export type IntakeSource = "platform_address" | "connected_mailbox" | "upload" | "paste";
export type IntakeStatus =
  | "received"
  | "blocked"
  | "unmatched"
  | "ambiguous"
  | "matched"
  | "processing"
  | "drafted"
  | "no_roles"
  | "failed"
  | "discarded";
export type MatchMethod = "contact_email" | "verified_domain" | "manual" | "forwarded_contact";
export type IntakeTab = "needs_attention" | "drafted" | "all";

export interface IntakeMessageSummary {
  id: string;
  source: IntakeSource;
  from_address: string | null;
  from_name: string | null;
  subject: string | null;
  received_at: string;
  status: IntakeStatus;
  status_reason: string | null;
  client_id: string | null;
  client_name: string | null;
  draft_demand_ids: string[];
  group_label: string | null;
}

export interface IntakeAttachment {
  file_id: string | null;
  filename: string;
  media_type: string;
  size: number;
  scan_status: string;
  text_file_id: string | null;
}

export interface IntakeMatch {
  status: string;
  method: MatchMethod | null;
  client_id: string | null;
  client_name: string | null;
  contact_id: string | null;
  contact_name: string | null;
  owner_user_id: string | null;
  explanation: string | null;
}

export interface DraftRef {
  id: string;
  human_id: string | null;
  title: string | null;
  status: string | null;
}

export interface IntakeMessage extends IntakeMessageSummary {
  body_preview: string | null;
  attachments: IntakeAttachment[];
  match: IntakeMatch;
  drafts: DraftRef[];
  owner_user_id: string | null;
  run_id: string | null;
  task_id: string | null;
  processed_at: string | null;
  auth_result: string | null;
}

/** `POST /agent-runs` result (foundation `RunRef`). */
export interface RunRef {
  run_id: string | null;
  status: string;
  reason: string | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface IntakeSettings {
  intake_mode: IntakeMode;
  mailbox_user_id: string | null;
  mailbox_folder: string;
  mailbox_status: "connected" | "needs_reconnect" | "not_connected" | null;
  fallback_owner_id: string | null;
  accept_forwarded: boolean;
  require_sender_auth: boolean;
  platform_address: string | null;
  warnings: string[];
}

export type IntakeSettingsIn = Partial<
  Pick<
    IntakeSettings,
    "intake_mode" | "mailbox_user_id" | "mailbox_folder" | "fallback_owner_id" | "accept_forwarded" | "require_sender_auth"
  >
>;

export interface SenderDomain {
  id: string;
  domain: string;
  client_id: string;
  client_name: string | null;
  verified_by: string;
  verified_by_name: string | null;
  verified_at: string;
  note: string | null;
}

export interface SenderDomainIn {
  domain: string;
  client_id: string;
  confirmed: boolean;
  note?: string | null;
}

export interface AgentSettings {
  duplicate_threshold: string;
  duplicate_window_days: number;
  sla_risk_probability: string;
  sla_digest_max_items: number;
  roles_per_message_max: number;
  sla_scan_owner_id: string | null;
  ack_contact_on_intake: boolean;
  jd_template_md: string | null;
  warnings: string[];
}

export interface AgentSettingsIn {
  duplicate_threshold?: string;
  duplicate_window_days?: number;
  sla_risk_probability?: string;
  sla_digest_max_items?: number;
  roles_per_message_max?: number;
  sla_scan_owner_id?: string | null;
  ack_contact_on_intake?: boolean;
  jd_template_md?: string | null;
}

// ---------------------------------------------------------------- insights
export interface FieldSource {
  field: string;
  source_quote: string;
}

export type SuggestionKind = "skill" | "new_skill" | "contract" | "rate_card";

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  payload: {
    label?: string;
    skill_ref?: { kind: string; id: string; status?: string } | null;
    skill_kind?: "mandatory" | "preferred";
    min_proficiency?: number | null;
    min_years?: string | null;
    evidence?: string | null;
    id?: string;
  };
  status: "pending" | "accepted" | "dismissed" | "superseded";
  created_at: string;
  decided_at: string | null;
}

export interface Reason {
  field: string;
  detail: string;
}

export interface NextStep {
  label: string;
  url: string;
}

export interface RelatedDemand {
  related_visible: boolean;
  demand_id: string | null;
  human_id: string | null;
  title: string | null;
  status: string | null;
}

export type FlagKind = "possible_duplicate" | "sla_risk";
export type FlagResolution = "linked_duplicate" | "distinct" | "dismissed";

export interface DemandFlag {
  id: string;
  demand_id: string;
  demand_human_id: string | null;
  kind: FlagKind;
  status: string;
  score: string | null;
  reasons: Reason[];
  summary: string | null;
  milestone: string | null;
  basis: string | null;
  p_late: string | null;
  next_steps: NextStep[];
  related: RelatedDemand | null;
  raised_by_kind: string;
  run_id: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
}

export interface SlaClock {
  milestone: string;
  status: string;
  due_at: string;
  elapsed_pct: number;
}

export interface SlaRisk {
  demand_id: string;
  at_risk: boolean;
  basis: "prediction" | "pipeline_only" | "late" | "none";
  basis_text: string;
  p_late: string | null;
  milestone: string | null;
  clocks: SlaClock[];
  counts: Record<string, number>;
  reasons: string[];
  next_steps: NextStep[];
}

export interface DemandInsights {
  demand_id: string;
  field_sources: FieldSource[];
  suggestions: Suggestion[];
  flags: DemandFlag[];
  sla: SlaRisk | null;
  agent_enabled: boolean;
  last_run: { run_id: string; status: string; created_at: string } | null;
  pending_jd_proposal_id: string | null;
}
