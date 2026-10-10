/** Epic 32 escalation API types (hand-written mirrors of `app/schemas/sla.py` until `npm run gen:api`). */

export type AfterUnit = "business_hours" | "business_days" | "hours";
export type EscalationAction = "notify" | "reassign";
export type EscalationTargetKind = "named_user" | "assignee_manager" | "role";

export type EscalationPolicyIn = {
  name: string;
  after_value: string;
  after_unit: AfterUnit;
  action: EscalationAction;
  target_kind: EscalationTargetKind;
  target_user_id: string | null;
  target_role_id: string | null;
  repeat_every_value: string | null;
  max_repeats: number;
  notify_original_assignee: boolean;
  is_active: boolean;
};

export type EscalationPolicyOut = EscalationPolicyIn & {
  id: string;
  owner_kind: string;
  owner_ref: string | null;
  after_business_hours: string;
  calendar: string;
  archived_at: string | null;
  source_policy_id: string | null;
  summary: string;
  created_at: string;
  updated_at: string;
};

export type ChainStepEscalationOut = { position: number; policy_id: string | null; copy_id: string; name: string | null; summary: string };
export type ChainEscalationsOut = { chain_id: string; steps: ChainStepEscalationOut[] };
export type ChainEscalationsIn = { steps: { position: number; policy_id: string | null }[] };

export type EscalationWatchOut = {
  id: string;
  policy_id: string | null;
  subject_kind: "approval_step" | "task";
  subject_id: string;
  step_position: number | null;
  started_at: string;
  next_fire_at: string | null;
  fires: number;
  status: "active" | "done" | "cancelled";
  last_outcome: string | null;
  history: { fire: number; at: string; outcome: string; targets: string[] }[];
  spec: Record<string, unknown>;
};
