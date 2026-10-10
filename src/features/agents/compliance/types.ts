/** Epic 62 DTOs (hand-written mirror of `app/schemas/chasing.py`; no gen:api, see agentic-types.ts). */

export interface SuppressedChannel {
  channel: string;
  reason: string;
}

export interface ChaseOut {
  id: string;
  candidate_id: string;
  placement_id: string | null;
  item_kind: "checklist_item" | "credential" | "permit";
  item_ref: string;
  item_label: string;
  due_basis: "start_date" | "expiry";
  due_on: string;
  offset_days: number;
  channels: string[];
  suppressed: SuppressedChannel[];
  escalated: boolean;
  task_id: string | null;
  escalated_to_name: string | null;
  agent_run_id: string | null;
  sent_at: string;
}

export interface RiskItem {
  label: string;
  status: string;
  kind: string;
}

export interface RiskRow {
  placement_id: string;
  placement_ref: string | null;
  candidate_id: string;
  worker_name: string;
  client_id: string;
  client_name: string | null;
  start_date: string;
  days_to_start: number;
  status: string;
  missing_items: RiskItem[];
  last_contact: string | null;
  portal_last_seen: string | null;
  chases_sent: number;
  escalation_task_id: string | null;
  escalated: boolean;
  bgv_status: string | null;
}

export interface RiskListOut {
  days: number;
  rows: RiskRow[];
  cadence: Record<string, unknown>;
}

export interface FollowUpOut {
  id: string;
  check_id: string;
  check_type: string;
  check_label: string;
  provider_name: string | null;
  channel: "connector" | "email";
  seq: number;
  status: string;
  provider_status: string | null;
  days_overdue: number | null;
  sent_at: string;
}

export interface OverdueCheckOut {
  check_id: string;
  type: string;
  subject_label: string;
  provider_name: string | null;
  provider_kind: string | null;
  has_connector: boolean;
  due_on: string | null;
  days_overdue: number;
  follow_ups_sent: number;
  last_follow_up_on: string | null;
  next_due_on: string | null;
  limit_reached: boolean;
}

export interface CaseFollowUpsOut {
  case_id: string;
  max_follow_ups: number;
  follow_up_every_working_days: number;
  overdue: OverdueCheckOut[];
  follow_ups: FollowUpOut[];
  limit_task_owner_name: string | null;
}

export interface RunRef {
  run_id: string | null;
  status: string;
  reason: string | null;
}
