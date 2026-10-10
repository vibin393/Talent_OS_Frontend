/** Epic 62 pure display logic (Vitest-covered). */
import type { ChaseOut, FollowUpOut, OverdueCheckOut, RiskRow, RunRef } from "./types";

const REASONS: Record<string, string> = {
  opted_out: "opted out",
  no_phone: "no phone on record",
  no_address: "no email on record",
  no_consent: "no WhatsApp consent",
  no_template: "no approved template",
  not_allowed: "not allowed",
  suppressed: "suppressed",
};

export function suppressedText(s: { channel: string; reason: string }): string {
  return `${s.channel === "sms" ? "SMS" : s.channel === "whatsapp" ? "WhatsApp" : s.channel.charAt(0).toUpperCase() + s.channel.slice(1)} not sent: ${REASONS[s.reason] ?? s.reason.replace(/_/g, " ")}`;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function chaseLine(c: ChaseOut): string {
  const days = Math.abs(c.offset_days);
  const basis = c.due_basis === "start_date" ? "start" : "expiry";
  const when = c.offset_days >= 0 ? `${days} days before ${basis}` : `${days} days after ${basis}`;
  const channels = c.channels.length ? c.channels.join(", ") : "no channel";
  return `${shortDate(c.sent_at)} · ${c.item_label} · ${channels} · ${when}`;
}

export function portalSeen(row: RiskRow): { text: string; warn: boolean } {
  return row.portal_last_seen ? { text: shortDate(row.portal_last_seen), warn: false } : { text: "Never", warn: true };
}

export function followUpLine(f: FollowUpOut, max: number): string {
  if (f.channel === "connector") return `${f.check_label} · Status requested via connector: ${f.provider_status ?? f.status}`;
  const overdue = f.days_overdue != null ? `${f.days_overdue} days overdue · ` : "";
  return `${f.check_label} · ${f.provider_name ?? "Provider"} · ${overdue}Follow-up ${f.seq} of ${max} sent ${shortDate(f.sent_at)}`;
}

export function limitReached(overdue: OverdueCheckOut[]): boolean {
  return overdue.some((o) => o.limit_reached);
}

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
