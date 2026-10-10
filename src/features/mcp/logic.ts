/** Pure helpers of the AI assistant access (MCP) pages (Epic 73, spec B2-B4). */
import type { Execution, LowToolMode, McpMe, SessionStatus } from "./api";

/** The four creating tools whose autonomy a tenant may change (everything else that changes or sends is a proposal). */
export const LOW_TOOLS: readonly { key: string; label: string }[] = [
  { key: "notes.add", label: "Add notes" },
  { key: "tasks.create", label: "Create tasks" },
  { key: "demands.create_draft", label: "Draft demands" },
  { key: "messaging.create_draft", label: "Draft messages" },
];

export const LOW_MODE_LABELS: Record<LowToolMode, string> = { suggest: "Ask for approval", auto: "Run without approval" };

export function executionBadge(execution: Execution, mode: LowToolMode = "suggest"): string {
  if (execution === "read") return "Reads";
  if (execution === "propose") return "Proposes";
  return mode === "auto" ? "Creates (runs at once)" : "Creates (needs approval)";
}

export const STATUS_LABELS: Record<SessionStatus, { label: string; color: "success" | "warning" | "subtle" }> = {
  active: { label: "Active", color: "success" },
  paused: { label: "Paused", color: "warning" },
  ended: { label: "Ended", color: "subtle" },
};

export const END_REASONS: Record<string, string> = {
  client_closed: "Closed by the assistant or the user",
  idle: "Idle for 30 minutes",
  kill_switch: "Ecosystem kill switch",
  ai_kill_switch: "AI kill switch",
  mcp_disabled: "AI assistant access turned off",
  uninstalled: "The assistant app was removed or suspended",
  authorization_revoked: "Access was revoked",
  user_deactivated: "The user was deactivated",
  bulk_read: "Read an unusual number of candidate records",
  admin: "Ended by an AI Administrator",
};

export function endReasonLabel(reason: string | null): string {
  return reason ? (END_REASONS[reason] ?? reason) : "";
}

export type LimitsForm = {
  calls_per_minute: number;
  calls_per_user_day: number;
  proposals_per_hour: number;
  bulk_read_threshold: number;
  max_results: number;
};

/** Field -> message for out-of-range values; `tier` caps the per-minute limit. */
export function limitErrors(v: LimitsForm, tier: number): Partial<Record<keyof LimitsForm, string>> {
  const out: Partial<Record<keyof LimitsForm, string>> = {};
  const range = (k: keyof LimitsForm, lo: number, hi: number) => {
    const n = v[k];
    if (!Number.isInteger(n) || n < lo || n > hi) out[k] = `Enter a whole number from ${lo.toLocaleString("en-IN")} to ${hi.toLocaleString("en-IN")}.`;
  };
  range("calls_per_minute", 5, Math.min(120, tier));
  range("calls_per_user_day", 100, 2000);
  range("proposals_per_hour", 1, 25);
  range("bulk_read_threshold", 50, 500);
  range("max_results", 10, 50);
  return out;
}

export function tierHint(tier: number): string {
  return `Your plan allows up to ${tier}`;
}

const ORIGIN = /^https:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?$/;

/** Validation message of an allowed origin (https only, max 10), or null. */
export function originError(origin: string, existing: readonly string[]): string | null {
  const o = origin.trim().replace(/\/$/, "");
  if (!ORIGIN.test(o)) return "Enter an https origin such as https://assistant.example.com.";
  if (existing.includes(o.toLowerCase())) return "This origin is already listed.";
  if (existing.length >= 10) return "You can list up to 10 origins.";
  return null;
}

export function canEnable(acknowledged: boolean, groups: readonly string[], agenticEnabled: boolean): boolean {
  return acknowledged && groups.length > 0 && agenticEnabled;
}

export type MyAssistantsState = "disabled" | "no_permission" | "on_hold" | "ready";

export function myAssistantsState(me: McpMe | undefined): MyAssistantsState | null {
  if (!me) return null;
  if (!me.enabled) return "disabled";
  if (!me.has_permission) return "no_permission";
  if (me.on_hold) return "on_hold";
  return "ready";
}

export const MY_ASSISTANTS_TEXT: Record<Exclude<MyAssistantsState, "ready">, string> = {
  disabled: "Your organisation hasn't turned on AI assistant access.",
  no_permission: "You don't have permission to connect AI assistants.",
  on_hold:
    "Your AI assistant access is paused because a session read an unusual number of records. Your AI Administrator can restore it.",
};
