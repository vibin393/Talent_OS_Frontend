/** Epic 55 Demand Agent pure helpers (labels, banner text, SLA basis text, sender-domain checks, proposal renderers). */
import { defaultRenderer, plainText, type ProposalRenderer } from "@/features/agent-proposals/proposal-renderers";
import type { DemandFlag, IntakeStatus, IntakeTab, SlaRisk, Suggestion } from "./types";

export const INTAKE_STATUS_LABELS: Record<IntakeStatus, string> = {
  received: "Received",
  blocked: "Blocked (unsafe file)",
  unmatched: "Unmatched",
  ambiguous: "Ambiguous",
  matched: "Processing",
  processing: "Processing",
  drafted: "Drafted",
  no_roles: "No roles found",
  failed: "Failed",
  discarded: "Discarded",
};

export type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";

export const INTAKE_STATUS_COLORS: Record<IntakeStatus, BadgeColor> = {
  received: "informative",
  blocked: "danger",
  unmatched: "warning",
  ambiguous: "warning",
  matched: "informative",
  processing: "informative",
  drafted: "success",
  no_roles: "subtle",
  failed: "danger",
  discarded: "subtle",
};

export const INTAKE_TABS: { key: IntakeTab; label: string }[] = [
  { key: "needs_attention", label: "Needs attention" },
  { key: "drafted", label: "Drafted" },
  { key: "all", label: "All" },
];

export const NEEDS_ATTENTION: readonly IntakeStatus[] = ["unmatched", "ambiguous", "failed", "blocked", "no_roles"];

export function canAssign(status: IntakeStatus): boolean {
  return status === "unmatched" || status === "ambiguous";
}

export function canRetry(status: IntakeStatus, clientId: string | null): boolean {
  return (status === "failed" || status === "no_roles") && clientId !== null;
}

export function canDiscard(status: IntakeStatus): boolean {
  return status !== "processing" && status !== "discarded" && status !== "matched";
}

export function senderLabel(name: string | null, address: string | null): string {
  if (name && address) return `${name} <${address}>`;
  return address || name || "Unknown sender";
}

// ---------------------------------------------------------------- duplicate banner
/** "{REQ-1041} looks similar: same title, 4 of 5 skills, same hiring contact." / the not-visible text. */
export function duplicateBannerText(flag: Pick<DemandFlag, "related" | "reasons">): string {
  if (!flag.related || !flag.related.related_visible) return "Similar to a demand you can't see. Ask your manager.";
  const details = flag.reasons.map((r) => r.detail).join(", ") || "several fields match";
  return `${flag.related.human_id ?? "Another demand"} looks similar: ${details}.`;
}

export function openDuplicateFlags(flags: readonly DemandFlag[]): DemandFlag[] {
  return flags.filter((f) => f.kind === "possible_duplicate" && f.status === "open");
}

export const LINKED_MESSAGE = "Linked. To close this demand, use Change status → Cancelled with reason Duplicate.";

// ---------------------------------------------------------------- SLA risk
export const BASIS_PIPELINE_TEXT = "Based on pipeline progress only (no time-to-fill model)";

/** "Based on the time-to-fill prediction (68% likely to miss)" etc. (the server text, with a local fallback). */
export function slaBasisText(risk: Pick<SlaRisk, "basis" | "basis_text" | "p_late">): string {
  if (risk.basis_text) return risk.basis_text;
  if (risk.basis === "prediction" && risk.p_late !== null) {
    return `Based on the time-to-fill prediction (${Math.round(Number(risk.p_late) * 100)}% likely to miss)`;
  }
  if (risk.basis === "late") return "A milestone is already late";
  return BASIS_PIPELINE_TEXT;
}

export const MILESTONE_LABELS: Record<string, string> = {
  assignment: "Assignment",
  first_submission: "First submission",
  first_interview: "First interview",
  client_feedback: "Client feedback",
  target_closure: "Target closure",
};

// ---------------------------------------------------------------- suggestions
export function skillSuggestions(items: readonly Suggestion[]): Suggestion[] {
  return items.filter((s) => (s.kind === "skill" || s.kind === "new_skill") && s.status === "pending");
}

export function linkSuggestions(items: readonly Suggestion[]): Suggestion[] {
  return items.filter((s) => (s.kind === "contract" || s.kind === "rate_card") && s.status === "pending");
}

export function isNewSkill(s: Pick<Suggestion, "kind">): boolean {
  return s.kind === "new_skill";
}

export function skillKindLabel(kind: string | undefined): string {
  return kind === "preferred" ? "Nice to have" : "Must have";
}

// ---------------------------------------------------------------- sender domains
export const PUBLIC_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.co.in",
  "yahoo.in",
  "ymail.com",
  "rediffmail.com",
  "rediff.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "zoho.com",
]);

const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Client-side check of the "Domain" field (the server re-validates): null when valid, else the message. */
export function domainError(raw: string): string | null {
  const domain = raw.trim().toLowerCase().replace(/^@/, "").replace(/\.$/, "");
  if (!domain) return "Enter a domain";
  if (!DOMAIN_RE.test(domain)) return "Enter a domain such as acme.com";
  if (PUBLIC_DOMAINS.has(domain)) return "Public email domains (such as gmail.com) can't identify a client";
  return null;
}

// ---------------------------------------------------------------- proposal renderers
const fieldLabel: Record<string, string> = {
  title: "Title",
  positions: "Positions",
  location: "Location",
  work_mode: "Work mode",
  employment_type: "Employment type",
  min_experience_years: "Min. experience (years)",
  max_experience_years: "Max. experience (years)",
  start_date: "Start date",
  mandatory_skills: "Must-have skills",
  pay_rate_min: "Pay rate (min)",
  pay_rate_max: "Pay rate (max)",
  currency: "Currency",
  rate_unit: "Rate unit",
  demand_id: "Demand",
};

/** `demands.create_draft`: the fields table with readable labels. */
export const createDraftRenderer: ProposalRenderer = (proposal) => {
  const base = defaultRenderer(proposal);
  return { ...base, rows: base.rows.map((r) => ({ label: fieldLabel[r.label] ?? r.label, value: r.value })) };
};

/** `demands.update` / `demands.update_draft`: JD summary + skills added / removed (the demand id row is hidden). */
export const demandUpdateRenderer: ProposalRenderer = (proposal) => {
  const base = defaultRenderer(proposal);
  return {
    title: base.title || "Update the demand",
    summary: plainText(base.summary),
    rows: base.rows.filter((r) => r.label !== "demand_id").map((r) => ({ label: fieldLabel[r.label] ?? r.label, value: r.value })),
  };
};

/** The Demand Agent is usable when both the agentic master switch and `agent_demand` are on (`GET /ai/features`). */
export function demandAgentOn(features: Record<string, boolean> | undefined | null): boolean {
  return features?.agentic === true && features?.agent_demand === true;
}

// ---------------------------------------------------------------- agent settings
export function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Percent (0-100) <-> decimal string ("0.72"). */
export function toPercent(value: string): number {
  return Math.round(Number(value) * 100);
}

export function fromPercent(pct: number, min: number, max: number): string {
  return (clampInt(pct, min, max) / 100).toFixed(2);
}
