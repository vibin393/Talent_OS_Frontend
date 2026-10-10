/** Epic 72 labels and banner selection (pure; covered by vitest). */
import type { ChannelStatus, EventLink, InterviewSync, MyChannel } from "./api";

export const RESPONSE_LABELS: Record<string, string> = {
  accepted: "Accepted",
  tentative: "Tentative",
  declined: "Declined",
  needs_action: "No response",
};

export function responseLabel(status: string | null | undefined): string {
  return RESPONSE_LABELS[status ?? "needs_action"] ?? "No response";
}

export const CHANNEL_STATUS_LABELS: Record<ChannelStatus, string> = {
  active: "Active",
  renewing: "Renewing",
  polling: "Polling",
  stopped: "Stopped",
  failed: "Failed",
};

export type SyncStatusText = { text: string; tone: "success" | "informative" | "danger" | "subtle" };

export function syncStatusText(tenantEnabled: boolean, ch: MyChannel | undefined): SyncStatusText {
  if (!tenantEnabled) return { text: "Off for your organisation", tone: "subtle" };
  if (!ch || ch.status === "none") return { text: "Syncing changes", tone: "success" };
  if (ch.status === "polling") return { text: `Checking every ${ch.poll_minutes} minutes`, tone: "informative" };
  if (ch.status === "stopped" || ch.status === "failed") return { text: "Not syncing — reconnect your calendar", tone: "danger" };
  return { text: "Syncing changes", tone: "success" };
}

export type Banner =
  | { kind: "moved_restored"; text: string }
  | { kind: "moved_proposal"; text: string }
  | { kind: "deleted"; text: string }
  | { kind: "conflict"; text: string }
  | { kind: "not_syncing"; text: string };

function fmt(iso: string | null): string {
  if (!iso) return "another time";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** The drawer banners for one Interview (spec B), most important first. */
export function banners(sync: InterviewSync, talentOsStart: string): Banner[] {
  const out: Banner[] = [];
  const org: EventLink | undefined = sync.links.find((l) => l.role === "organizer" && l.state !== "detached");
  const name = org?.organizer_name ?? "The organiser";
  if (org?.state === "conflict") {
    out.push({ kind: "conflict", text: `This interview's calendar event keeps moving. We stopped restoring it — please check with ${name}.` });
  } else if (org?.state === "deleted") {
    out.push({ kind: "deleted", text: `The calendar event was removed from ${name}'s calendar. The interview is still scheduled.` });
  } else if (org && (org.state === "moved" || org.state === "restoring")) {
    if (sync.move_policy === "keep_as_proposal") {
      out.push({
        kind: "moved_proposal",
        text: `${name}'s calendar shows ${fmt(org.seen_start)}. The interview is still at ${fmt(talentOsStart)}.`,
      });
    } else {
      out.push({
        kind: "moved_restored",
        text: `${name} moved this interview in their calendar to ${fmt(org.seen_start)}. We put it back to the Talent OS time and asked for a reschedule.`,
      });
    }
  }
  for (const p of sync.participants) {
    if (p.state === "not_syncing") {
      out.push({ kind: "not_syncing", text: `Calendar not syncing for ${p.name}. Changes they make in their calendar won't reach Talent OS.` });
    }
  }
  return out;
}
