/**
 * Hand-written DTOs of the Epic 39 sequence endpoints (`app/schemas/campaigns.py`).
 * Do not regenerate from the OpenAPI schema.
 */
import type { Channel } from "@/features/campaigns/types";

export type StepKind = "send" | "wait" | "branch" | "task" | "add_to_pool";
export type BranchOn = "opened" | "clicked" | "replied" | "applied";

export type SendConfig = {
  channel: Channel;
  subject?: string;
  body_html?: string;
  channel_template_id?: string | null;
  job_links?: { posting_id: string; label?: string | null }[];
};
export type WaitConfig = { days: number };
/** `then_position` / `else_position` are 1-based step positions after the branch. */
export type BranchConfig = { on: BranchOn; within_days: number; then_position: number | null; else_position: number | null };
export type TaskConfig = { title: string; assignee: string; due_days: number };
export type AddToPoolConfig = { talent_pool_id: string | null };

export type StepConfigByKind = {
  send: SendConfig;
  wait: WaitConfig;
  branch: BranchConfig;
  task: TaskConfig;
  add_to_pool: AddToPoolConfig;
};

/** A step as edited in the UI (position is the 1-based list index). */
export type StepDraft = { [K in StepKind]: { kind: K; config: StepConfigByKind[K] } }[StepKind];

export type StepIn = { kind: StepKind; config: Record<string, unknown> };
export type StepOut = { id: string; position: number; kind: StepKind; config: Record<string, unknown> };

export type SequenceStatus = "draft" | "active" | "paused" | "archived";
export type SequenceBasis = "marketing" | "own_application";
export type ExitOn = { replied: boolean; applied: boolean; hired: boolean; unsubscribed: boolean };

export type SequenceCreate = {
  name: string;
  description?: string | null;
  basis?: SequenceBasis;
  exit_on?: ExitOn | null;
  re_enrol_gap_days?: number;
  steps?: StepIn[];
};
export type SequenceUpdate = Partial<SequenceCreate>;

export type SequenceOut = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  status: SequenceStatus;
  current_version: number;
  draft_version: number;
  basis: SequenceBasis;
  exit_on: Record<string, boolean>;
  re_enrol_gap_days: number;
  steps: StepOut[];
  published_steps: StepOut[];
  active_enrollments: number;
  created_at: string;
  updated_at: string;
};

export type EnrolIn = { candidate_ids?: string[]; audience_id?: string };
export type EnrolRefusal = { candidate_id: string; reason: string };
export type EnrolOut = { enrolled: number; enrollment_ids: string[]; refused: EnrolRefusal[] };

export type EnrollmentStatus = "active" | "paused" | "completed" | "exited" | string;

export type EnrollmentOut = {
  id: string;
  sequence_id: string;
  candidate_id: string;
  candidate_name: string | null;
  version: number;
  status: EnrollmentStatus;
  exit_reason: string | null;
  position: number;
  next_run_at: string | null;
  origin: string;
  started_at: string;
  ended_at: string | null;
};
