/** Pure helpers for recruitment marketing campaigns and settings (Epic 39). */
import type { BadgeProps } from "@fluentui/react-components";
import { isApiError } from "@/lib/api/errors";
import type {
  CampaignOut,
  CampaignStatus,
  Channel,
  FunnelCounts,
  FunnelRates,
  MarketingSettingsOut,
  MarketingSettingsUpdate,
  SendWindow,
} from "./types";

export const CHANNEL_LABELS: Record<Channel, string> = { email: "Email", sms: "SMS", whatsapp: "WhatsApp" };

export function channelLabel(c: string | null | undefined): string {
  return c && c in CHANNEL_LABELS ? CHANNEL_LABELS[c as Channel] : (c ?? "—");
}

// Settings ---------------------------------------------------------------------------------------------

/** Platform quiet hours: tenants may narrow, never widen, these windows. */
export const DEFAULT_SEND_WINDOWS: Record<Channel, SendWindow> = {
  email: { start: "08:00", end: "21:00" },
  sms: { start: "09:00", end: "21:00" },
  whatsapp: { start: "09:00", end: "21:00" },
};

export const FREQUENCY_CAP_MIN = 1;
export const FREQUENCY_CAP_MAX = 3;

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minutes since midnight for "HH:MM", or null when malformed. */
export function toMinutes(hhmm: string): number | null {
  const m = HHMM.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Error text for a channel's send window, or null when it is valid (well-formed, start < end, inside the default). */
export function sendWindowError(channel: Channel, w: SendWindow): string | null {
  const start = toMinutes(w.start);
  const end = toMinutes(w.end);
  if (start === null || end === null) return "Enter times as HH:MM.";
  if (start >= end) return "The start must be before the end.";
  const def = DEFAULT_SEND_WINDOWS[channel];
  if (start < (toMinutes(def.start) ?? 0) || end > (toMinutes(def.end) ?? 24 * 60)) {
    return `Must stay within ${def.start}–${def.end}.`;
  }
  return null;
}

/** Clamp a SpinButton value for the frequency cap into 1..3 (null/NaN falls back to the max). */
export function clampFrequencyCap(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) return FREQUENCY_CAP_MAX;
  return Math.min(FREQUENCY_CAP_MAX, Math.max(FREQUENCY_CAP_MIN, Math.round(value)));
}

export type SettingsForm = {
  frequency_cap_count: number;
  send_windows: Record<Channel, SendWindow>;
  approval_threshold: number;
  ab_window_hours: number;
  rate_per_minute: Record<Channel, number>;
  daily_cap: Record<Channel, number>;
  footer_contact: string;
};

const CHANNELS: Channel[] = ["email", "sms", "whatsapp"];

function perChannel<T>(fn: (c: Channel) => T): Record<Channel, T> {
  return { email: fn("email"), sms: fn("sms"), whatsapp: fn("whatsapp") };
}

export function settingsToForm(s: MarketingSettingsOut): SettingsForm {
  return {
    frequency_cap_count: clampFrequencyCap(s.frequency_cap_count),
    send_windows: perChannel((c) => ({ ...(s.send_windows[c] ?? DEFAULT_SEND_WINDOWS[c]) })),
    approval_threshold: s.approval_threshold,
    ab_window_hours: s.ab_window_hours,
    rate_per_minute: perChannel((c) => s.rate_per_minute[c] ?? 0),
    daily_cap: perChannel((c) => s.daily_cap[c] ?? 0),
    footer_contact: s.footer_contact ?? "",
  };
}

/** Field errors keyed like `send_windows.sms`, `rate_per_minute.email`; empty when the form is valid. */
export function validateSettings(f: SettingsForm, s: Pick<MarketingSettingsOut, "platform_max_rate" | "platform_max_daily">): Record<string, string> {
  const errors: Record<string, string> = {};
  if (f.frequency_cap_count < FREQUENCY_CAP_MIN || f.frequency_cap_count > FREQUENCY_CAP_MAX) {
    errors.frequency_cap_count = `Choose ${FREQUENCY_CAP_MIN} to ${FREQUENCY_CAP_MAX}.`;
  }
  if (!Number.isInteger(f.approval_threshold) || f.approval_threshold < 1) errors.approval_threshold = "Enter 1 or more.";
  if (!Number.isInteger(f.ab_window_hours) || f.ab_window_hours < 1 || f.ab_window_hours > 72) errors.ab_window_hours = "Choose 1 to 72 hours.";
  for (const c of CHANNELS) {
    const w = sendWindowError(c, f.send_windows[c]);
    if (w) errors[`send_windows.${c}`] = w;
    const maxRate = s.platform_max_rate[c];
    const rate = f.rate_per_minute[c];
    if (!Number.isInteger(rate) || rate < 1) errors[`rate_per_minute.${c}`] = "Enter 1 or more.";
    else if (maxRate && rate > maxRate) errors[`rate_per_minute.${c}`] = `The platform maximum is ${maxRate.toLocaleString()}.`;
    const maxDaily = s.platform_max_daily[c];
    const daily = f.daily_cap[c];
    if (!Number.isInteger(daily) || daily < 1) errors[`daily_cap.${c}`] = "Enter 1 or more.";
    else if (maxDaily && daily > maxDaily) errors[`daily_cap.${c}`] = `The platform maximum is ${maxDaily.toLocaleString()}.`;
  }
  if (f.footer_contact.length > 500) errors.footer_contact = "Keep it under 500 characters.";
  return errors;
}

export function formToUpdate(f: SettingsForm): MarketingSettingsUpdate {
  return {
    frequency_cap_count: f.frequency_cap_count,
    send_windows: f.send_windows,
    approval_threshold: f.approval_threshold,
    ab_window_hours: f.ab_window_hours,
    rate_per_minute: f.rate_per_minute,
    daily_cap: f.daily_cap,
    footer_contact: f.footer_contact.trim() || null,
  };
}

// Campaigns --------------------------------------------------------------------------------------------

export const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  scheduled: "Scheduled",
  sending: "Sending",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STATUS_COLORS: Record<CampaignStatus, NonNullable<BadgeProps["color"]>> = {
  draft: "subtle",
  pending_approval: "warning",
  scheduled: "informative",
  sending: "brand",
  paused: "warning",
  completed: "success",
  cancelled: "danger",
};

export const CAMPAIGN_STATUSES = Object.keys(STATUS_LABELS) as CampaignStatus[];

export function canPause(c: Pick<CampaignOut, "status">): boolean {
  return c.status === "scheduled" || c.status === "sending";
}
export function canResume(c: Pick<CampaignOut, "status">): boolean {
  return c.status === "paused";
}
export function canCancel(c: Pick<CampaignOut, "status">): boolean {
  return ["draft", "pending_approval", "scheduled", "sending", "paused"].includes(c.status);
}

export const MERGE_FIELDS = [
  { token: "{{candidate.first_name}}", label: "Candidate first name" },
  { token: "{{candidate.full_name}}", label: "Candidate full name" },
  { token: "{{tenant.name}}", label: "Company name" },
] as const;

/** Insert `text` into `value` at the selection [start, end); returns the new value and caret position. */
export function insertAt(value: string, text: string, start: number | null, end: number | null): { value: string; caret: number } {
  const s = start === null ? value.length : Math.max(0, Math.min(start, value.length));
  const e = end === null ? s : Math.max(s, Math.min(end, value.length));
  return { value: value.slice(0, s) + text + value.slice(e), caret: s + text.length };
}

/** Merge token that renders a job link, `{{job_link.N}}` (N is the 1-based index in `job_links`). */
export function jobLinkToken(index: number): string {
  return `{{job_link.${index}}}`;
}

export const AB_SAMPLE_MIN = 2;
export const AB_SAMPLE_MAX = 20;

/** Error for an A/B sample percentage, or null when valid (2..20). */
export function abSampleError(pct: number | null | undefined): string | null {
  if (pct === null || pct === undefined || Number.isNaN(pct) || !Number.isInteger(pct)) return "Enter a whole number.";
  if (pct < AB_SAMPLE_MIN) return `Use at least ${AB_SAMPLE_MIN}%.`;
  if (pct > AB_SAMPLE_MAX) return `Use at most ${AB_SAMPLE_MAX}%.`;
  return null;
}

/** True when a campaign of `recipients` reaches the tenant's approval threshold. */
export function approvalRequired(recipients: number | null | undefined, threshold: number | null | undefined): boolean {
  if (recipients === null || recipients === undefined || !threshold) return false;
  return recipients >= threshold;
}

export type WizardDraft = {
  name: string;
  audience_id: string | null;
  channel: Channel;
  email_subject: string;
  email_body_html: string;
  channel_template_id: string | null;
  job_links: { posting_id: string; label: string }[];
  ab_enabled: boolean;
  ab_subject_b: string;
  ab_sample_pct: number;
  ab_metric: "open" | "click";
  ab_window_hours: number;
  schedule: "now" | "later";
  scheduled_at: string;
};

export type WizardStep = "audience" | "content" | "schedule" | "review";
export const WIZARD_STEPS: { value: WizardStep; label: string }[] = [
  { value: "audience", label: "Audience" },
  { value: "content", label: "Channel & content" },
  { value: "schedule", label: "Schedule" },
  { value: "review", label: "Review" },
];

/** Validation errors per wizard step (only the steps with errors are present). */
export function validateWizard(d: WizardDraft, now: Date = new Date()): Partial<Record<WizardStep, string[]>> {
  const out: Partial<Record<WizardStep, string[]>> = {};
  const add = (step: WizardStep, msg: string) => (out[step] ??= []).push(msg);
  if (!d.name.trim()) add("audience", "Enter a campaign name.");
  if (!d.audience_id) add("audience", "Choose an audience.");
  if (d.channel === "email") {
    if (!d.email_subject.trim()) add("content", "Enter a subject.");
    if (!d.email_body_html.trim()) add("content", "Enter the email body.");
    if (d.ab_enabled) {
      if (!d.ab_subject_b.trim()) add("content", "Enter the subject for variant B.");
      const e = abSampleError(d.ab_sample_pct);
      if (e) add("content", `A/B sample: ${e}`);
      if (d.ab_window_hours < 1 || d.ab_window_hours > 72) add("content", "A/B window: choose 1 to 72 hours.");
    }
  } else if (!d.channel_template_id) {
    add("content", "Choose a registered template.");
  }
  if (d.schedule === "later") {
    const t = new Date(d.scheduled_at);
    if (!d.scheduled_at || Number.isNaN(t.getTime())) add("schedule", "Choose a date and time.");
    else if (t.getTime() <= now.getTime()) add("schedule", "Choose a time in the future.");
  }
  return out;
}

export function wizardToCreate(d: WizardDraft) {
  const email = d.channel === "email";
  return {
    name: d.name.trim(),
    channel: d.channel,
    audience_id: d.audience_id ?? "",
    email_subject: email ? d.email_subject.trim() : null,
    email_body_html: email ? d.email_body_html : null,
    channel_template_id: email ? null : d.channel_template_id,
    job_links: email ? d.job_links.map((l) => ({ posting_id: l.posting_id, label: l.label.trim() || null })) : [],
    ab_test:
      email && d.ab_enabled && d.ab_subject_b.trim()
        ? {
            variants: [
              { key: "A" as const, subject: d.email_subject.trim() },
              { key: "B" as const, subject: d.ab_subject_b.trim() },
            ],
            sample_pct: d.ab_sample_pct,
            metric: d.ab_metric,
            window_hours: d.ab_window_hours,
          }
        : null,
  };
}

/** Timeline rows of a campaign's lifecycle timestamps that are set, in order. */
export function campaignTimeline(c: CampaignOut): { label: string; at: string }[] {
  const rows: [string, string | null][] = [
    ["Created", c.created_at],
    ["Scheduled for", c.scheduled_at],
    ["Started", c.started_at],
    ["Completed", c.completed_at],
    ["Cancelled", c.cancelled_at],
  ];
  return rows.filter((r): r is [string, string] => !!r[1]).map(([label, at]) => ({ label, at }));
}

export function campaignErrorMessage(e: unknown): string | null {
  if (!isApiError(e)) return null;
  switch (e.code) {
    case "invalid_transition":
      return "This campaign can no longer do that. Refresh to see its status.";
    case "template_not_registered":
      return "Pick a registered marketing template for this channel.";
    case "marketing_paused":
      return "Marketing is paused for your organization.";
    default:
      return null;
  }
}

// Funnel -----------------------------------------------------------------------------------------------

export const FUNNEL_STAGES: { key: keyof FunnelCounts; label: string; rate?: keyof FunnelRates }[] = [
  { key: "audience", label: "Audience" },
  { key: "sent", label: "Sent" },
  { key: "delivered", label: "Delivered", rate: "delivery_rate" },
  { key: "opened", label: "Opened", rate: "open_rate" },
  { key: "clicked", label: "Clicked", rate: "click_rate" },
  { key: "replied", label: "Replied", rate: "reply_rate" },
  { key: "applied", label: "Applied", rate: "apply_rate" },
  { key: "hired", label: "Hired", rate: "hire_rate" },
];

export type FunnelBar = { key: string; label: string; value: number; pct: number; rate: number | null };

/** Bars for the funnel chart; `pct` is the bar width relative to the largest stage (0..100). */
export function funnelBars(counts: FunnelCounts, rates?: FunnelRates | null): FunnelBar[] {
  const max = Math.max(0, ...FUNNEL_STAGES.map((s) => counts[s.key] ?? 0));
  return FUNNEL_STAGES.map((s) => {
    const value = counts[s.key] ?? 0;
    return {
      key: s.key,
      label: s.label,
      value,
      pct: max > 0 ? Math.round((value / max) * 1000) / 10 : 0,
      rate: s.rate && rates ? (rates[s.rate] ?? null) : null,
    };
  });
}

/** "12.5%" for a 0..1 rate. */
export function formatRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return "—";
  return `${(Math.round(rate * 1000) / 10).toLocaleString()}%`;
}
