/** Pure helpers for marketing audiences (Epic 39). */
import type { BadgeProps } from "@fluentui/react-components";
import type { Channel } from "@/features/campaigns/types";
import type { AudienceOut, AudiencePreviewOut, AudienceSourceIn, AudienceStatus, SourceKind, SourceMode } from "./types";

export const SUPPRESSION_REASON_LABELS: Record<string, string> = {
  no_marketing_consent: "No marketing consent",
  channel_opt_out: "Opted out of channel",
  no_whatsapp_optin: "No WhatsApp opt-in",
  no_address: "No email or phone",
  hard_bounce: "Hard bounce",
  complaint: "Complaint",
  frequency_cap: "Frequency cap",
  quiet_hours: "Quiet hours",
};

export function reasonLabel(reason: string): string {
  return SUPPRESSION_REASON_LABELS[reason] ?? reason.replace(/_/g, " ");
}

export const AUDIENCE_STATUS_LABELS: Record<AudienceStatus, string> = { draft: "Draft", active: "Active", archived: "Archived" };
export const AUDIENCE_STATUS_COLORS: Record<AudienceStatus, NonNullable<BadgeProps["color"]>> = {
  draft: "subtle",
  active: "success",
  archived: "informative",
};

export type SourceDraft = { mode: SourceMode; kind: SourceKind; id: string; name: string };

export function sourcesFromAudience(a: Pick<AudienceOut, "sources">): SourceDraft[] {
  return a.sources
    .map((s) => ({
      mode: s.mode,
      kind: s.kind,
      id: (s.kind === "pool" ? s.talent_pool_id : s.segment_id) ?? "",
      name: s.name ?? "Unnamed",
    }))
    .filter((s) => s.id);
}

export function sourcesToPayload(sources: SourceDraft[]): AudienceSourceIn[] {
  return sources.map((s) =>
    s.kind === "pool"
      ? { mode: s.mode, kind: "pool", talent_pool_id: s.id }
      : { mode: s.mode, kind: "segment", segment_id: s.id },
  );
}

/** Add a source unless the same (mode, kind, id) is already there. */
export function addSource(sources: SourceDraft[], next: SourceDraft): SourceDraft[] {
  if (sources.some((s) => s.mode === next.mode && s.kind === next.kind && s.id === next.id)) return sources;
  return [...sources, next];
}

export function removeSource(sources: SourceDraft[], target: Pick<SourceDraft, "mode" | "kind" | "id">): SourceDraft[] {
  return sources.filter((s) => !(s.mode === target.mode && s.kind === target.kind && s.id === target.id));
}

export function sameSources(a: SourceDraft[], b: SourceDraft[]): boolean {
  const key = (s: SourceDraft) => `${s.mode}:${s.kind}:${s.id}`;
  const ka = a.map(key).sort((x, y) => (String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0));
  const kb = b.map(key).sort((x, y) => (String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0));
  return ka.length === kb.length && ka.every((k, i) => k === kb[i]);
}

export type SuppressedRow = { reason: string; label: string; email: number; sms: number; whatsapp: number };

const CHANNELS: Channel[] = ["email", "sms", "whatsapp"];

/** Pivot `suppressed[channel][reason]` into one row per reason (sorted by total, largest first). */
export function suppressedRows(preview: Pick<AudiencePreviewOut, "suppressed">): SuppressedRow[] {
  const reasons = new Set<string>();
  for (const c of CHANNELS) for (const r of Object.keys(preview.suppressed[c] ?? {})) reasons.add(r);
  return [...reasons]
    .map((reason) => ({
      reason,
      label: reasonLabel(reason),
      email: preview.suppressed.email?.[reason] ?? 0,
      sms: preview.suppressed.sms?.[reason] ?? 0,
      whatsapp: preview.suppressed.whatsapp?.[reason] ?? 0,
    }))
    .sort((a, b) => b.email + b.sms + b.whatsapp - (a.email + a.sms + a.whatsapp) || a.label.localeCompare(b.label));
}

/** Suppressed total for one channel (or the max across channels when none is given). */
export function suppressedTotal(preview: Pick<AudiencePreviewOut, "suppressed">, channel?: Channel | null): number {
  const sum = (c: Channel) => Object.values(preview.suppressed[c] ?? {}).reduce((a, b) => a + b, 0);
  return channel ? sum(channel) : Math.max(0, ...CHANNELS.map(sum));
}

export const IMPORT_ACCEPT = ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export function importFileError(file: Pick<File, "name" | "size"> | null): string | null {
  if (!file) return "Choose a CSV or XLSX file.";
  if (!/\.(csv|xlsx)$/i.test(file.name)) return "Only CSV or XLSX files are supported.";
  if (file.size > IMPORT_MAX_BYTES) return "The file is larger than 5 MB.";
  return null;
}
