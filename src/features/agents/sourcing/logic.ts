/** Epic 56 pure helpers (labels, counters, selections). The UI never re-sorts entries: the server rank is the order. */
import type { Channel, DismissReason, DraftStatus, EntryOut, ShortlistOut, SourceRef } from "./types";

export const CHANNELS: Channel[] = ["email", "whatsapp", "sms"];
export const CHANNEL_LABELS: Record<Channel, string> = { email: "Email", whatsapp: "WhatsApp", sms: "SMS" };
export const MESSAGE_MAX = 4000;

export const DISMISS_REASONS: { value: DismissReason; label: string }[] = [
  { value: "not_interested", label: "Not interested" },
  { value: "skills_gap", label: "Skills gap" },
  { value: "experience", label: "Experience" },
  { value: "compensation", label: "Compensation" },
  { value: "location", label: "Location" },
  { value: "availability", label: "Availability" },
  { value: "duplicate", label: "Duplicate" },
  { value: "other", label: "Other" },
];

const REASON_LABELS: Record<string, string> = {
  no_marketing_consent: "no marketing consent",
  channel_opt_out: "opted out",
  no_whatsapp_optin: "no WhatsApp opt-in",
  no_address: "no address on record",
  hard_bounce: "address bounced",
  complaint: "marked as spam",
  frequency_cap: "weekly limit reached",
  dismissed: "dismissed",
  paused: "marketing paused",
};

/** "Suppressed: weekly limit reached" style label of a governance reason. */
export function reasonLabel(reason: string | null | undefined): string {
  if (!reason) return "Suppressed";
  const key = reason.startsWith("suppressed:") ? reason.slice("suppressed:".length) : reason;
  return REASON_LABELS[key] ?? key.replace(/_/g, " ");
}

export function contactTooltip(channel: Channel, state: { ok: boolean; reason: string | null } | undefined): string {
  const name = CHANNEL_LABELS[channel];
  if (!state) return `${name}: unknown`;
  return state.ok ? `${name}: can be contacted` : `${name} — Suppressed: ${reasonLabel(state.reason)}`;
}

export const OUTREACH_LABELS: Record<DraftStatus, string | null> = {
  none: null,
  proposed: "Waiting for approval",
  sent: "Sent",
  failed: "Failed",
  suppressed: "Suppressed",
};

/** Outreach column text: a stored draft that is not yet a pending Proposal shows "Draft ready". */
export function outreachLabel(entry: Pick<EntryOut, "draft_status" | "draft_body" | "outreach_proposal_id">): string | null {
  if (entry.draft_status === "none") return entry.draft_body ? "Draft ready" : null;
  if (entry.draft_status === "proposed" && !entry.outreach_proposal_id) return "Draft ready";
  return OUTREACH_LABELS[entry.draft_status];
}

export function sourceLabel(source: SourceRef): string {
  switch (source.kind) {
    case "match":
      return "Match";
    case "pool":
      return source.label || "Pool";
    case "silver_medalist":
      return "Silver medalist";
    case "search":
      return "Search";
    case "rediscovery":
      return "Rediscovery";
    default:
      return "Source";
  }
}

/** "Excluded: 2 already in pipeline · 1 do not contact · 0 placed · 1 archived". */
export function excludedLine(counts: Record<string, number> | undefined): string {
  const c = counts ?? {};
  const n = (k: string) => c[k] ?? 0;
  return `Excluded: ${n("in_pipeline")} already in pipeline · ${n("do_not_contact")} do not contact · ${n("placed")} placed · ${n("archived")} archived`;
}

export function versionLabel(version: number, createdAt: string): string {
  const d = new Date(createdAt);
  const date = Number.isNaN(d.getTime()) ? createdAt : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return `Version ${version} · ${date}`;
}

export function counterText(text: string): string {
  return `${text.length}/${MESSAGE_MAX}`;
}

export function scoreText(overall: number | null): string {
  return overall == null ? "—" : String(Math.round(overall));
}

export function noticeText(days: number | null): string {
  if (days == null) return "—";
  return days === 0 ? "Immediate" : `${days} days`;
}

/** Entries shown in the grid, in server rank order (dismissed only when "Show dismissed" is on). */
export function visibleEntries(shortlist: ShortlistOut | null | undefined, showDismissed: boolean): EntryOut[] {
  if (!shortlist) return [];
  return shortlist.entries.filter((e) => showDismissed || e.status !== "dismissed");
}

/** Pending outreach Proposals of the selected entries (for "Approve outreach (n)"). */
export function approvableProposalIds(entries: EntryOut[], selected: ReadonlySet<string>): string[] {
  return entries
    .filter((e) => selected.has(e.id) && e.draft_status === "proposed" && e.outreach_proposal_id)
    .map((e) => e.outreach_proposal_id as string);
}

export function addableIds(entries: EntryOut[], selected: ReadonlySet<string>): string[] {
  return entries.filter((e) => selected.has(e.id) && e.status === "suggested").map((e) => e.id);
}

/** One line per bulk-decision result for the result Dialog. */
export function bulkResultLines(
  results: { human_id: string; title: string; status: string; error_code: string | null }[],
): string[] {
  return results.map((r) => {
    if (r.status === "executed") return `${r.human_id}: sent`;
    if (r.error_code?.startsWith("suppressed:")) return `${r.human_id}: Not sent: ${reasonLabel(r.error_code)}`;
    if (r.status === "stale") return `${r.human_id}: changed since it was drafted`;
    return `${r.human_id}: ${r.status.replace(/_/g, " ")}${r.error_code ? ` (${r.error_code})` : ""}`;
  });
}

export function runDisabledReason(agentEnabled: boolean): string | null {
  return agentEnabled ? null : "The Sourcing Agent is off";
}
