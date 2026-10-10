/** Epic 63 DTOs (hand-written mirror of `app/schemas/timesheet_flags.py`, `collection_rules.py` and the billing
 * `RunPreviewOut`; no gen:api, see agentic-types.ts). */

export type FlagSeverity = "info" | "warning";
export type FlagStatus = "open" | "reviewed" | "dismissed" | "superseded";

export interface FlagOut {
  id: string;
  timesheet_id: string;
  placement_id: string;
  rule: string;
  label: string;
  severity: FlagSeverity;
  entry_dates: string[];
  facts: Record<string, number | string>;
  group_key: string | null;
  explanation: string | null;
  explanation_source: "rules" | "ai";
  rules_description: string;
  status: FlagStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  timesheet_version: number;
  created_at: string;
}

export interface FlagCount {
  timesheet_id: string;
  open_count: number;
  max_severity: FlagSeverity;
}

export interface RunRef {
  run_id: string | null;
  status: string;
  reason: string | null;
}

export type Tone = "courteous" | "friendly" | "firm" | "escalation";
export type Audience = "billing_contacts" | "escalation_contact" | "both";

export interface StepIn {
  position: number;
  offset_days: number;
  tone: Tone;
  audience: Audience;
  email_template_id: string | null;
  allow_auto: boolean;
  create_task: boolean;
  active: boolean;
}

export interface StepOut extends StepIn {
  id: string;
}

export interface RuleOut {
  id: string;
  client_id: string | null;
  client_name: string | null;
  name: string;
  active: boolean;
  escalation_contact_id: string | null;
  escalation_contact_name: string | null;
  max_reminders_per_week: number;
  quiet_start: string;
  quiet_end: string;
  timezone: string;
  steps: StepOut[];
  auto_steps: number;
  updated_at: string | null;
}

export interface RuleIn {
  client_id: string | null;
  name: string;
  active: boolean;
  escalation_contact_id: string | null;
  max_reminders_per_week: number;
  quiet_start: string;
  quiet_end: string;
  timezone: string;
  steps?: StepIn[];
}

export interface HoldOut {
  id: string;
  client_id: string;
  document_kind: "invoice" | "debit_note" | null;
  document_id: string | null;
  mode: "paused" | "takeover";
  reason: string | null;
  created_by: string | null;
  created_at: string;
  released_at: string | null;
  released_by: string | null;
}

export interface AgentStateOut {
  client_id: string;
  state: "active" | "paused" | "taken_over";
  holds: HoldOut[];
}

export interface PlanDocument {
  document_kind: string;
  document_id: string;
  number: string | null;
  due_date: string | null;
  days_overdue: number;
  currency: string;
  open_amount: string;
  disputed_amount: string;
  remindable_amount: string;
}

export interface PlanItem {
  step_id: string;
  position: number;
  offset_days: number;
  tone: Tone;
  audience: Audience;
  email_template_id: string | null;
  send_class: "pre_due_auto_eligible" | "needs_approval";
  create_task: boolean;
  currency: string;
  total_remindable: string;
  partially_disputed: boolean;
  documents: PlanDocument[];
}

export interface CollectionPlanOut {
  client_id: string;
  today: string;
  rule_id: string | null;
  rule_name: string | null;
  held: boolean;
  items: PlanItem[];
  excluded: { document_id: string; number: string | null; reason: string }[];
}

export interface LogOut {
  id: string;
  client_id: string;
  document_ids: string[];
  event: string;
  label: string;
  tone: string | null;
  proposal_id: string | null;
  proposal_human_id: string | null;
  actor_name: string | null;
  summary: string | null;
  at: string;
}

export interface PreviewException {
  kind: string;
  category: "po_missing" | "po_cap_breach" | "rate_mismatch" | "unapproved_time" | "billing_rule_missing" | "mixed_currency" | "other";
  placement_id: string | null;
  severity: string;
}

export interface PreviewClient {
  client_id: string;
  client_name: string | null;
  currency: string | null;
  drafts: number;
  total: string;
  exceptions: PreviewException[];
}

/** The Billing Agent's run result (``BillingResult``) as read from the run. */
export interface BillingResult {
  outcome: string;
  summary: string;
  period: string | null;
  legal_entity_id: string | null;
  clients: { client_id: string; drafts: number; total: string; currency: string | null; exceptions: string[] }[];
  proposal_id: string | null;
}
