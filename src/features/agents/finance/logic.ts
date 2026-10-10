/** Epic 63 pure display logic (Vitest-covered): flag grouping and labels, collection rule validation, hold states,
 * plan wording, invoice-run exceptions and the dunning Proposal edit limits. */
import type { AgentStateOut, FlagOut, PlanItem, RunRef, StepIn, Tone } from "./types";

export const FLAG_LABELS: Record<string, string> = {
  hours_on_leave: "Hours on approved leave",
  holiday_work: "Work on a public holiday",
  weekend_work: "Weekend work",
  daily_hours_vs_schedule: "Long day",
  weekly_overtime_vs_history: "Overtime well above usual",
  peer_outlier: "Hours above project peers",
  po_hours_cap: "PO hours cap",
  zero_hours_period: "Zero hours",
  duplicate_entry_pattern: "Repeated identical entries",
};

export const FLAGS_FOOTER = "These checks never block approval and never change hours.";

export function flagLabel(rule: string): string {
  return FLAG_LABELS[rule] ?? rule.replace(/_/g, " ");
}

/** The explanation the agent wrote, else the rules-only description. */
export function flagText(flag: Pick<FlagOut, "explanation" | "rules_description">): string {
  return flag.explanation?.trim() ? flag.explanation : `Rule: ${flag.rules_description}`;
}

export function hasAiExplanation(flags: Pick<FlagOut, "explanation_source" | "explanation">[]): boolean {
  return flags.some((f) => f.explanation_source === "ai" && Boolean(f.explanation));
}

export interface FlagGroup {
  key: string;
  flags: FlagOut[];
}

const SEVERITY_RANK: Record<string, number> = { warning: 0, info: 1 };

/** Group by `group_key` (ungrouped flags stand alone), warnings first, then by label. Superseded flags are hidden. */
export function groupFlags(flags: FlagOut[]): FlagGroup[] {
  const live = flags.filter((f) => f.status !== "superseded");
  const groups = new Map<string, FlagOut[]>();
  for (const f of live) {
    const key = f.group_key ? `group:${f.group_key}` : `flag:${f.id}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  const sortFlags = (a: FlagOut, b: FlagOut) =>
    (SEVERITY_RANK[a.severity] ?? 2) - (SEVERITY_RANK[b.severity] ?? 2) || flagLabel(a.rule).localeCompare(flagLabel(b.rule));
  return [...groups.entries()]
    .map(([key, list]) => ({ key, flags: [...list].sort(sortFlags) }))
    .sort((a, b) => sortFlags(a.flags[0], b.flags[0]));
}

export function flagDates(dates: string[]): string {
  if (!dates.length) return "";
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  };
  return dates.length > 3 ? `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])} (${dates.length} days)` : dates.map(fmt).join(", ");
}

// ---------------------------------------------------------------- collection rules
export const AUTO_RULE_MESSAGE =
  "Only pre-due courteous or friendly reminders to billing contacts with a template can be sent automatically.";

export const TONE_LABELS: Record<Tone, string> = { courteous: "Courteous", friendly: "Friendly", firm: "Firm", escalation: "Escalation" };
export const AUDIENCE_LABELS: Record<string, string> = {
  billing_contacts: "Billing contacts",
  escalation_contact: "Escalation contact",
  both: "Both",
};

export function canSendAutomatically(step: Pick<StepIn, "offset_days" | "email_template_id" | "audience" | "tone">): boolean {
  return step.offset_days < 0 && Boolean(step.email_template_id) && step.audience === "billing_contacts" && (step.tone === "courteous" || step.tone === "friendly");
}

/** Client-side mirror of the server rules (schema validator + CHECK ``auto``); the server stays authoritative. */
export function stepErrors(steps: StepIn[]): Record<number, string> {
  const out: Record<number, string> = {};
  const seen = new Set<number>();
  steps.forEach((s, i) => {
    if (s.offset_days < -30 || s.offset_days > 180) out[i] = "Days from due date must be between -30 and 180.";
    else if (s.allow_auto && !canSendAutomatically(s)) out[i] = AUTO_RULE_MESSAGE;
    else if (seen.has(s.position)) out[i] = "Each step needs its own position.";
    seen.add(s.position);
  });
  return out;
}

export function sendLabel(allowAuto: boolean): string {
  return allowAuto ? "Automatically (pre-due only)" : "After approval";
}

// ---------------------------------------------------------------- holds and the plan
export function agentStateLabel(state: AgentStateOut["state"] | undefined): string {
  return state === "paused" ? "Paused" : state === "taken_over" ? "Taken over" : "Active";
}

export function takeoverMessage(client: string, invoice: string): string {
  return `You have taken over. The agent will not contact ${client} about ${invoice}.`;
}

export function invoiceHold(state: AgentStateOut | undefined, invoiceId: string) {
  return state?.holds.find((h) => h.document_id === invoiceId && !h.released_at) ?? null;
}

export function clientHold(state: AgentStateOut | undefined) {
  return state?.holds.find((h) => h.document_id === null && !h.released_at) ?? null;
}

export function planLine(item: PlanItem): string {
  const docs = item.documents.map((d) => d.number ?? "invoice").join(", ");
  const when = item.offset_days < 0 ? `${Math.abs(item.offset_days)} days before due` : `${item.offset_days} days after due`;
  return `Step ${item.position} (${when}) · ${TONE_LABELS[item.tone] ?? item.tone} · ${docs}`;
}

export function sendClassLabel(item: Pick<PlanItem, "send_class">): string {
  return item.send_class === "pre_due_auto_eligible" ? "Sends automatically" : "Needs approval";
}

// ---------------------------------------------------------------- invoice run preparation
export const EXCEPTION_LABELS: Record<string, string> = {
  po_missing: "Missing PO",
  po_cap_breach: "PO cap reached",
  rate_mismatch: "Rate outside rate card",
  unapproved_time: "Unapproved time",
  billing_rule_missing: "No billing rule",
  mixed_currency: "Mixed currency",
};

export function exceptionLabels(kinds: string[]): string {
  const labels = [...new Set(kinds.map((k) => EXCEPTION_LABELS[k] ?? k.replace(/_/g, " ")))];
  return labels.length ? labels.join(", ") : "None";
}

export const DRAFTS_NOTE = "Invoices are created as drafts. Numbers are assigned only when a person issues them.";

export function runStartedMessage(ref: RunRef, agent: string): { intent: "success" | "warning"; text: string } {
  if (ref.run_id && ref.status !== "not_started") return { intent: "success", text: `The ${agent} is working on it.` };
  const why: Record<string, string> = {
    feature_off: `The ${agent} is not enabled.`,
    kill_switch: "AI agents are stopped by the kill switch.",
    owner_unavailable: "No owner is available for this run.",
    agent_budget_paused: "The agent's monthly budget is used up.",
  };
  return { intent: "warning", text: why[ref.reason ?? ""] ?? `The ${agent} could not start (${ref.reason ?? "unknown"}).` };
}

// ---------------------------------------------------------------- dunning Proposal edits
export const DUNNING_EDITABLE = ["subject", "body"] as const;

/** Edited args of a dunning Proposal may change only the subject and body (re-checked by the server's policy check). */
export function editedDunningArgs(original: Record<string, unknown>, edits: { subject?: string; body?: string }): Record<string, unknown> {
  const out = { ...original };
  for (const key of DUNNING_EDITABLE) {
    const value = edits[key];
    if (typeof value === "string" && value.trim()) out[key] = value.slice(0, key === "subject" ? 200 : 3000);
  }
  return out;
}

export function onlyEditableChanged(original: Record<string, unknown>, edited: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(original), ...Object.keys(edited)]);
  return [...keys].every((k) => (DUNNING_EDITABLE as readonly string[]).includes(k) || JSON.stringify(original[k]) === JSON.stringify(edited[k]));
}
