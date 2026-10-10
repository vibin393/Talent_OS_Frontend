/**
 * Hand-written DTOs of the Epic 78 AI campaign copy endpoints (`app/schemas/campaign_copy.py`).
 * Do not regenerate from the OpenAPI schema. Datetimes are ISO strings.
 */

import type { Channel } from "../types";

export type CopyPurpose = "reengage" | "new_jobs" | "event" | "referral_ask" | "nurture" | "other";
export type CopyTone = "friendly" | "professional" | "concise" | "enthusiastic";
export type ApplyMode = "single" | "ab_subjects" | "per_segment_campaigns";
export type AttributeField = "city" | "primary_skill" | "experience_band" | "last_active_band";

export type CopyBrief = {
  purpose: CopyPurpose;
  purpose_note: string;
  tone: CopyTone;
  call_to_action: string;
  posting_ids: string[];
  demand_ids: string[];
  language: "en";
};

export type SegmentSource = { kind: "audience_source"; id: string } | { kind: "attribute"; field: AttributeField; value: string };

export type CopySegment = { key: string; label: string; source: SegmentSource };

export type CopyRequestIn = {
  campaign_id?: string | null;
  sequence_step_id?: string | null;
  channel: Channel;
  brief: CopyBrief;
  segments: CopySegment[];
  variants_per_segment: number;
  channel_template_id?: string | null;
};

export type Finding = { code: string; severity: "block" | "warn"; field: string; excerpt: string };

export type CopyDraftStatus = "generated" | "checked" | "edited" | "approved" | "used" | "discarded";

export type CopyDraftOut = {
  id: string;
  request_id: string;
  segment_key: string;
  segment_label: string;
  variant_no: number;
  channel: Channel;
  subject: string | null;
  preheader: string | null;
  body_html: string | null;
  template_values: Record<string, string> | null;
  job_link_blocks: { posting_id: string; cta: string }[];
  status: CopyDraftStatus;
  findings: Finding[];
  blocked: boolean;
  needs_ack: boolean;
  warnings_acknowledged: boolean;
  ai_generated: boolean;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  rubber_stamp: boolean;
  edited_at: string | null;
  used_in_campaign_id: string | null;
  used_at: string | null;
  content_sha256: string;
};

export type SegmentOut = { key: string; label: string; source: Record<string, unknown>; reachable: number | null; drafts: CopyDraftOut[] };

export type CopyRequestStatus = "requested" | "generating" | "generated" | "failed" | "cancelled";

export type CopyRequestOut = {
  id: string;
  campaign_id: string | null;
  sequence_id: string | null;
  sequence_step_id: string | null;
  step_position: number | null;
  channel: Channel;
  status: CopyRequestStatus;
  variants_per_segment: number;
  segment_count: number;
  agent_run_id: string | null;
  error_code: string | null;
  fallback_message: string | null;
  requested_by: string;
  created_at: string;
};

export type CopyRequestDetailOut = CopyRequestOut & {
  brief: Record<string, unknown>;
  segments: SegmentOut[];
  summary: { segments: number; variants: number; blocked: number };
};

export type DraftEditIn = {
  subject?: string | null;
  preheader?: string | null;
  body_html?: string | null;
  template_values?: Record<string, string> | null;
};

export type ApplyIn = { draft_ids: string[]; mode: ApplyMode };
export type ApplyOut = { mode: ApplyMode; campaign_ids: string[]; sequence_id: string | null; draft_ids: string[] };

export type CopyStatusOut = {
  uses_ai_copy: boolean;
  draft_id: string | null;
  request_id: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  changed_after_approval: boolean;
};
