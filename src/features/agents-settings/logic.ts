/** Pure logic of the agent settings pages (Epic 65, spec B4). */
import type { AgentCatalogOut, AutonomyMode, RiskClass } from "@/lib/api/agentic-types";
import { isApiError } from "@/lib/api/errors";
import type { AgentCatalogDetail, AgentConfigIn, ChecklistItem, WorkingHours } from "@/lib/api/governance-types";

export const HIGH_RISK_TOOLTIP = "High-risk actions always need a person's approval";
export const BURN_IN_TOOLTIP = "Auto is available after the burn-in ends";

export type ModeOption = { value: AutonomyMode; label: string; disabled: boolean; tooltip: string | null };

/** Whether the agent is in its suggest-only burn-in at `now`. */
export function inBurnIn(burnInUntil: string | null | undefined, now = Date.now()): boolean {
  if (!burnInUntil) return false;
  const t = Date.parse(burnInUntil);
  return Number.isFinite(t) && t > now;
}

/** Mode dropdown options of an action: *Auto* hidden for high risk and disabled during burn-in. */
export function modeOptions(risk: RiskClass | string, burnIn: boolean): ModeOption[] {
  const out: ModeOption[] = [
    { value: "off", label: "Off", disabled: false, tooltip: null },
    { value: "suggest", label: "Suggest", disabled: false, tooltip: null },
  ];
  if (risk === "high") return out;
  out.push({ value: "auto", label: "Auto", disabled: burnIn, tooltip: burnIn ? BURN_IN_TOOLTIP : null });
  return out;
}

/** Explanation shown next to the mode control when *Auto* is unavailable. */
export function autoUnavailableReason(risk: RiskClass | string, burnIn: boolean): string | null {
  if (risk === "high") return HIGH_RISK_TOOLTIP;
  if (burnIn) return BURN_IN_TOOLTIP;
  return null;
}

/** Server 422 / 409 codes of agent settings as user text. */
export const AGENT_ERROR_TEXT: Record<string, string> = {
  autonomy_not_allowed: HIGH_RISK_TOOLTIP,
  burn_in_active: BURN_IN_TOOLTIP,
  limit_above_ceiling: "Above the platform limit",
  budget_above_tenant: "Above the tenant budget",
  unknown_role: "This role no longer exists. Choose another queue.",
  tool_not_allowlisted: "This action is not available to this agent.",
  reason_required: "Enter a reason of at least 10 characters.",
  burn_in_not_active: "The burn-in has already ended.",
  notice_version_mismatch: "The enablement notice changed. Read the current notice and accept it again.",
  human_only_action: "Only a signed-in person can change this.",
};

export function agentErrorText(e: unknown): string {
  if (isApiError(e)) {
    if (AGENT_ERROR_TEXT[e.code]) return AGENT_ERROR_TEXT[e.code];
    if (e.status === 403) return "You can no longer perform this action.";
    if (e.message) return e.message;
  }
  return "Something went wrong. Please try again.";
}

// ---------------------------------------------------------------- list grid
export type StatusBadge = { label: string; color: "subtle" | "warning" | "success" | "informative" };

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function agentStatus(a: Pick<AgentCatalogOut, "placeholder" | "enabled" | "burn_in_until">, now = Date.now()): StatusBadge {
  if (a.placeholder) return { label: "Not available yet", color: "informative" };
  if (!a.enabled) return { label: "Off", color: "subtle" };
  if (inBurnIn(a.burn_in_until, now)) return { label: `On · suggest-only until ${formatDate(a.burn_in_until)}`, color: "warning" };
  return { label: "On", color: "success" };
}

export function readinessText(items: readonly Pick<ChecklistItem, "status">[]): string {
  const relevant = items.filter((i) => i.status !== "not_applicable");
  const ready = relevant.filter((i) => i.status === "ready").length;
  return `${ready}/${relevant.length} ready`;
}

export function budgetUsedText(a: Pick<AgentCatalogOut, "monthly_token_budget" | "used_this_month">): string {
  const used = a.used_this_month.toLocaleString("en-US");
  if (!a.monthly_token_budget) return `${used} tokens`;
  return `${used} / ${a.monthly_token_budget.toLocaleString("en-US")} (${Math.round((a.used_this_month / a.monthly_token_budget) * 100)}%)`;
}

// ---------------------------------------------------------------- checklist
/** Blocking items that are not ready (the "Some prerequisites are missing" dialog lists them). */
export function blockingItems(items: readonly ChecklistItem[]): ChecklistItem[] {
  return items.filter((i) => i.blocking && i.status !== "ready" && i.status !== "not_applicable");
}

export type EnableDecision = { kind: "enable" } | { kind: "confirm"; missing: ChecklistItem[] };

/** Turning an agent on: straight enable, or the prerequisites dialog when blocking items are missing. */
export function enableDecision(items: readonly ChecklistItem[] | undefined): EnableDecision {
  const missing = blockingItems(items ?? []);
  return missing.length ? { kind: "confirm", missing } : { kind: "enable" };
}

export function overrideReasonError(enableAnyway: boolean, reason: string): string | null {
  if (!enableAnyway) return "Check “Enable anyway” or fix the prerequisites first.";
  return reason.trim().length < 10 ? "Enter at least 10 characters." : null;
}

export const CHECKLIST_STATUS: Record<string, { label: string; color: "success" | "danger" | "warning" | "subtle" }> = {
  ready: { label: "Ready", color: "success" },
  missing: { label: "Missing", color: "danger" },
  warning: { label: "Warning", color: "warning" },
  not_applicable: { label: "Not applicable", color: "subtle" },
};

// ---------------------------------------------------------------- budget & limits
export const LIMIT_FIELDS = [
  { key: "max_steps", label: "Max steps per run" },
  { key: "max_tool_calls", label: "Max tool calls per run" },
  { key: "max_writes", label: "Max writes per run" },
  { key: "max_tokens_per_run", label: "Max tokens per run" },
] as const;

export type BudgetDraft = { monthly_token_budget: number | null; limits: Record<string, number> };

/** Field errors of the budget tab ("Above the platform limit" / "Above the tenant budget"). */
export function budgetErrors(
  d: BudgetDraft,
  ceiling: Record<string, number> | undefined,
  tenantBudget: number | null | undefined,
): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.monthly_token_budget !== null) {
    if (!Number.isInteger(d.monthly_token_budget) || d.monthly_token_budget < 0) e.monthly_token_budget = "Enter a whole number of tokens.";
    else if (tenantBudget !== null && tenantBudget !== undefined && d.monthly_token_budget > tenantBudget) e.monthly_token_budget = "Above the tenant budget";
  }
  for (const { key } of LIMIT_FIELDS) {
    const v = d.limits[key];
    if (v === undefined) continue;
    if (!Number.isInteger(v) || v < 1) e[key] = "Enter a whole number from 1.";
    else if (ceiling?.[key] !== undefined && v > ceiling[key]) e[key] = "Above the platform limit";
  }
  return e;
}

export function expiryError(hours: number | null | undefined): string | null {
  if (hours === null || hours === undefined) return null;
  return Number.isInteger(hours) && hours >= 1 && hours <= 720 ? null : "Enter 1 to 720 hours.";
}

// ---------------------------------------------------------------- config draft
export type ConfigDraft = {
  default_mode: AutonomyMode;
  monthly_token_budget: number | null;
  limits: Record<string, number>;
  triggers_enabled: Record<string, boolean>;
  channels: string[];
  working_hours: WorkingHours | null;
  proposal_expiry_hours: number | null;
  /** Per tool: mode + queue role. */
  actions: Record<string, { mode: AutonomyMode; route_role_key: string | null }>;
};

export function draftFrom(a: AgentCatalogDetail): ConfigDraft {
  return {
    default_mode: a.default_mode,
    monthly_token_budget: a.monthly_token_budget,
    limits: { ...a.limits },
    triggers_enabled: Object.fromEntries(a.triggers.map((t) => [t.key, t.enabled])),
    channels: [...(a.channels ?? [])],
    working_hours: a.working_hours ?? null,
    proposal_expiry_hours: a.proposal_expiry_hours ?? null,
    actions: Object.fromEntries(a.tools.map((t) => [t.key, { mode: t.mode, route_role_key: t.route_role_key }])),
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The `PATCH /agents/{key}` body (changed fields only) and the changed actions (`PUT .../actions/{tool}`). */
export function configChanges(
  base: ConfigDraft,
  draft: ConfigDraft,
): { patch: AgentConfigIn; actions: { tool_key: string; mode: AutonomyMode; route_role_key: string | null }[] } {
  const patch: AgentConfigIn = {};
  if (base.default_mode !== draft.default_mode) patch.default_mode = draft.default_mode;
  if (base.monthly_token_budget !== draft.monthly_token_budget) patch.monthly_token_budget = draft.monthly_token_budget;
  if (!same(base.limits, draft.limits)) patch.limits = draft.limits;
  if (!same(base.triggers_enabled, draft.triggers_enabled)) patch.triggers_enabled = draft.triggers_enabled;
  if (!same(base.channels, draft.channels)) patch.channels = draft.channels;
  if (!same(base.working_hours, draft.working_hours)) patch.working_hours = draft.working_hours;
  if (base.proposal_expiry_hours !== draft.proposal_expiry_hours) patch.proposal_expiry_hours = draft.proposal_expiry_hours;
  const actions = Object.entries(draft.actions)
    .filter(([k, v]) => !same(base.actions[k], v))
    .map(([tool_key, v]) => ({ tool_key, ...v }));
  return { patch, actions };
}

export function isDirty(base: ConfigDraft, draft: ConfigDraft): boolean {
  const c = configChanges(base, draft);
  return Object.keys(c.patch).length > 0 || c.actions.length > 0;
}

export const CHANNEL_LABELS: Record<string, string> = { email: "Email", sms: "SMS", whatsapp: "WhatsApp", portal: "Portal" };
export const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const DAY_LABELS: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

export const AGENT_TABS = [
  { value: "actions", label: "Actions & autonomy" },
  { value: "triggers", label: "Triggers" },
  { value: "routing", label: "Routing & expiry" },
  { value: "budget", label: "Budget & limits" },
  { value: "channels", label: "Channels & hours" },
  { value: "readiness", label: "Readiness" },
  { value: "evaluation", label: "Evaluation" },
  { value: "history", label: "Change history" },
] as const;

/** Effective mode text: resolved mode + reason ("Suggest · burn-in"). */
export function effectiveModeText(mode: string, reason: string | null | undefined): string {
  const label = mode === "auto" ? "Auto" : mode === "suggest" ? "Suggest" : "Off";
  return reason ? `${label} · ${reason.replace(/_/g, " ")}` : label;
}

/** Fallback enablement notice text when the server does not return one. */
export const ENABLEMENT_NOTICE = [
  "AI agents act for a named person in your organisation (the Accountable Owner) and every agent output is labelled as AI.",
  "Agents start in suggest-only mode for 14 days: every action is a Proposal that a person approves. Afterwards you may allow automatic low-risk actions per agent; high-risk actions always need a person.",
  "The AI model provider is a sub-processor and may process data outside India. Candidates are told an AI assistant is involved and how to withdraw.",
  "You can stop all agents at once with the kill switch, and every run is recorded in the AI governance console.",
];
