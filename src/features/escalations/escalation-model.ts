import type { AfterUnit, EscalationAction, EscalationPolicyIn, EscalationPolicyOut, EscalationTargetKind } from "./types";

/** Pure helpers of the escalation policy editor (Epic 32 B3). */

export const MAX_ESCALATIONS = 5;

export const UNIT_LABELS: Record<AfterUnit, string> = {
  business_hours: "Business hours",
  business_days: "Business days",
  hours: "Hours (calendar)",
};

export const TARGET_LABELS: Record<EscalationTargetKind, string> = {
  assignee_manager: "The assignee's team lead",
  named_user: "A named user",
  role: "Everyone in a role",
};

export const ACTION_LABELS: Record<EscalationAction, string> = {
  notify: "Notify",
  reassign: "Reassign",
};

export type PolicyDraft = {
  name: string;
  afterValue: string;
  afterUnit: AfterUnit;
  action: EscalationAction;
  targetKind: EscalationTargetKind;
  targetUserId: string | null;
  targetRoleId: string | null;
  repeat: boolean;
  repeatEvery: string;
  maxRepeats: string;
  notifyOriginal: boolean;
  isActive: boolean;
};

export function emptyPolicy(): PolicyDraft {
  return {
    name: "",
    afterValue: "8",
    afterUnit: "business_hours",
    action: "notify",
    targetKind: "assignee_manager",
    targetUserId: null,
    targetRoleId: null,
    repeat: false,
    repeatEvery: "8",
    maxRepeats: "1",
    notifyOriginal: true,
    isActive: true,
  };
}

function trimNum(v: string): string {
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : v;
}

export function policyDraft(p: EscalationPolicyOut): PolicyDraft {
  return {
    name: p.name ?? "",
    afterValue: trimNum(p.after_value),
    afterUnit: p.after_unit,
    action: p.action,
    targetKind: p.target_kind,
    targetUserId: p.target_user_id,
    targetRoleId: p.target_role_id,
    repeat: p.max_repeats > 0,
    repeatEvery: p.repeat_every_value ? trimNum(p.repeat_every_value) : "8",
    maxRepeats: String(Math.max(p.max_repeats, 1)),
    notifyOriginal: p.notify_original_assignee,
    isActive: p.is_active,
  };
}

export type PolicyErrors = Partial<Record<"name" | "afterValue" | "target" | "repeatEvery" | "maxRepeats", string>>;

export function validatePolicy(d: PolicyDraft): PolicyErrors {
  const e: PolicyErrors = {};
  if (!d.name.trim()) e.name = "Give the policy a name.";
  const after = Number(d.afterValue);
  if (!Number.isFinite(after) || after <= 0) e.afterValue = "Enter a positive number.";
  else if (d.afterUnit === "business_days" && !Number.isInteger(after)) e.afterValue = "Use whole business days.";
  if (d.targetKind === "named_user" && !d.targetUserId) e.target = "Choose the user.";
  if (d.targetKind === "role" && !d.targetRoleId) e.target = "Choose the role.";
  if (d.repeat) {
    const every = Number(d.repeatEvery);
    if (!Number.isFinite(every) || every <= 0) e.repeatEvery = "Enter a positive number.";
    const n = Number(d.maxRepeats);
    if (!Number.isInteger(n) || n < 1 || n > MAX_ESCALATIONS - 1) e.maxRepeats = `Repeat 1 to ${MAX_ESCALATIONS - 1} times (${MAX_ESCALATIONS} escalations at most).`;
  }
  return e;
}

export function policyIn(d: PolicyDraft): EscalationPolicyIn {
  return {
    name: d.name.trim(),
    after_value: d.afterValue.trim(),
    after_unit: d.afterUnit,
    action: d.action,
    target_kind: d.targetKind,
    target_user_id: d.targetKind === "named_user" ? d.targetUserId : null,
    target_role_id: d.targetKind === "role" ? d.targetRoleId : null,
    repeat_every_value: d.repeat ? d.repeatEvery.trim() : null,
    max_repeats: d.repeat ? Number(d.maxRepeats) : 0,
    notify_original_assignee: d.notifyOriginal,
    is_active: d.isActive,
  };
}

function unitText(value: number, unit: AfterUnit): string {
  const label = unit === "business_hours" ? "business hour" : unit === "business_days" ? "business day" : "hour";
  return `${value} ${label}${value === 1 ? "" : "s"}`;
}

/** Plain-language summary shown in lists and pickers ("Notify the team lead after 8 business hours"). */
export function describePolicy(d: PolicyDraft): string {
  const who = d.targetKind === "assignee_manager" ? "the team lead" : d.targetKind === "role" ? "a role" : "a named user";
  let text = `${d.action === "reassign" ? "Reassign to" : "Notify"} ${who} after ${unitText(Number(d.afterValue), d.afterUnit)}`;
  if (d.repeat) text += `, then every ${unitText(Number(d.repeatEvery), d.afterUnit)} (${Number(d.maxRepeats)}x more)`;
  return text;
}

/** Chain-step picker state: position -> library policy id ("" = none). */
export function chainSelection(steps: readonly { position: number; policy_id: string | null }[], count: number): string[] {
  const out = Array.from({ length: count }, () => "");
  for (const s of steps) if (s.position >= 1 && s.position <= count && s.policy_id) out[s.position - 1] = s.policy_id;
  return out;
}

export function chainBody(selection: readonly string[]): { steps: { position: number; policy_id: string | null }[] } {
  return { steps: selection.map((id, i) => ({ position: i + 1, policy_id: id || null })) };
}

/** Timeline entries written by escalations: "Escalated to … after … (n of m)" / "Reassigned to …". */
export function isEscalationEntry(activity: { kind: string; body: string }): boolean {
  return activity.kind === "system" && /^(Escalated|Reassigned) to .+ after .+ \(\d+ of \d+\)$/.test(activity.body);
}
