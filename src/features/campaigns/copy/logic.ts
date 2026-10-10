/** Pure helpers of the Epic 78 AI campaign copy UI (request validation, approve / apply availability, labels). */

import type { Channel } from "../types";
import type { ApplyMode, CopyDraftOut, CopyPurpose, CopyRequestIn, CopySegment, CopyTone, Finding } from "./types";

export const MAX_SEGMENTS = 20;
export const MAX_VARIANTS = 3;
export const MAX_POSTINGS = 10;

export const PURPOSE_OPTIONS: { value: CopyPurpose; label: string }[] = [
  { value: "reengage", label: "Re-engage" },
  { value: "new_jobs", label: "Share new jobs" },
  { value: "event", label: "Invite to an event" },
  { value: "referral_ask", label: "Ask for referrals" },
  { value: "nurture", label: "Nurture" },
  { value: "other", label: "Other" },
];

export const TONE_OPTIONS: { value: CopyTone; label: string }[] = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "concise", label: "Concise" },
  { value: "enthusiastic", label: "Enthusiastic" },
];

export const FINDING_LABELS: Record<string, string> = {
  protected_attribute: "Mentions a protected characteristic",
  biased_term: "Possibly exclusionary wording",
  compensation_out_of_range: "Pay figure outside the published range",
  unsupported_claim: "Claim not in the job posting or brief",
  foreign_link: "Link to a site that is not allowed",
  unknown_merge_field: "Unknown merge field",
  unsubscribe_tampering: "Own unsubscribe link or hidden text",
  missing_optout_sms: "SMS template has no opt-out text",
  template_variable_limit: "Template variable rule broken",
  spam_heuristics: "Looks like spam",
  length: "Too long or missing",
  html_unsafe: "Unsafe HTML",
};

export type RequestDraft = {
  channel: Channel;
  templateId: string | null;
  purpose: CopyPurpose;
  note: string;
  tone: CopyTone;
  cta: string;
  postingIds: string[];
  segments: CopySegment[];
  variants: number;
};

export function emptyRequest(channel: Channel): RequestDraft {
  return { channel, templateId: null, purpose: "new_jobs", note: "", tone: "friendly", cta: "", postingIds: [], segments: [], variants: 2 };
}

export function segmentKey(label: string, taken: string[]): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 34) || "segment";
  let key = base;
  let n = 2;
  while (taken.includes(key)) key = `${base}_${n++}`;
  return key;
}

/** Field errors of the "Draft copy with AI" dialog; an empty object = can generate. */
export function validateRequest(d: RequestDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (d.segments.length === 0) errors.segments = "Add at least one segment.";
  if (d.segments.length > MAX_SEGMENTS) errors.segments = `Use at most ${MAX_SEGMENTS} segments.`;
  if (d.variants < 1 || d.variants > MAX_VARIANTS) errors.variants = `Choose 1 to ${MAX_VARIANTS} variants.`;
  if (d.channel !== "email" && !d.templateId) errors.template = "Choose an approved template.";
  if (d.note.length > 300) errors.note = "Use at most 300 characters.";
  if (d.cta.length > 80) errors.cta = "Use at most 80 characters.";
  if (d.postingIds.length > MAX_POSTINGS) errors.postings = `Link at most ${MAX_POSTINGS} jobs.`;
  d.segments.forEach((s, i) => {
    if (!s.label.trim()) errors[`segments.${i}`] = "Name the segment.";
    else if (s.source.kind === "attribute" && !s.source.value.trim()) errors[`segments.${i}`] = "Enter the attribute value.";
  });
  return errors;
}

export function toRequest(d: RequestDraft, target: { campaignId?: string; sequenceStepId?: string }): CopyRequestIn {
  return {
    campaign_id: target.campaignId ?? null,
    sequence_step_id: target.sequenceStepId ?? null,
    channel: d.channel,
    brief: { purpose: d.purpose, purpose_note: d.note.trim(), tone: d.tone, call_to_action: d.cta.trim(), posting_ids: d.postingIds, demand_ids: [], language: "en" },
    segments: d.segments.map((s) => ({ ...s, label: s.label.trim() })),
    variants_per_segment: d.variants,
    channel_template_id: d.channel === "email" ? null : d.templateId,
  };
}

export const blocking = (findings: Finding[]) => findings.filter((f) => f.severity === "block");
export const warnings = (findings: Finding[]) => findings.filter((f) => f.severity === "warn");

/** Why "Approve" is disabled (null = enabled). */
export function approveDisabledReason(d: CopyDraftOut, canApprove: boolean): string | null {
  if (!canApprove) return "You need permission to approve AI copy.";
  if (d.status === "approved" || d.status === "used") return "Already approved.";
  if (d.status === "discarded") return "This draft was discarded.";
  if (blocking(d.findings).length > 0) return "Fix the issues marked Must fix";
  if (d.needs_ack) return "Acknowledge the checks first";
  return null;
}

/** The "Approved by {name}" / "Changed — needs approval" badge text. */
export function draftBadge(d: CopyDraftOut): string | null {
  if (d.status === "approved" || d.status === "used") return `Approved by ${d.approved_by_name || "a reviewer"}`;
  if (d.status === "edited" && d.edited_at) return "Changed — needs approval";
  return null;
}

/** Which apply modes the selected drafts allow. */
export function applyModes(selected: CopyDraftOut[], target: "campaign" | "sequence_step"): Record<ApplyMode, boolean> {
  const approved = selected.filter((d) => d.status === "approved");
  const allApproved = approved.length === selected.length && selected.length > 0;
  const segments = new Set(selected.map((d) => d.segment_key));
  const sameBody = selected.length === 2 && selected[0].body_html === selected[1].body_html;
  return {
    single: allApproved && selected.length === 1,
    ab_subjects: target === "campaign" && allApproved && selected.length === 2 && segments.size === 1 && sameBody && selected.every((d) => d.channel === "email"),
    per_segment_campaigns: target === "campaign" && allApproved && selected.length >= 1 && segments.size === selected.length,
  };
}

export function summaryLine(s: { segments: number; variants: number; blocked: number }): string {
  return `${s.segments} segments · ${s.variants} variants · ${s.blocked} need changes`;
}

export function findingLabel(f: Finding): string {
  return FINDING_LABELS[f.code] ?? f.code;
}

/** SM-C23: a segment's drafts are marked opened the first time an approver opens its tab. */
export function shouldMarkOpened(segmentKey: string, alreadyOpened: ReadonlySet<string>): boolean {
  return segmentKey !== "" && !alreadyOpened.has(segmentKey);
}
