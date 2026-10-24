/** Pure helpers for Epic 33 messaging screens (unit-tested in messaging.test.ts). */
import { tokenPaths, unknownPaths } from "@/features/comms/merge-tokens";
import type {
  Channel,
  ChannelTemplate,
  ChannelTemplateIn,
  CustomDomain,
  CustomDomainStatus,
  Eligibility,
  MessageStatus,
  TemplatePurpose,
} from "./types";

export type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";
export type BadgeSpec = { label: string; color: BadgeColor };

export const CHANNEL_LABELS: Record<Channel, string> = { sms: "SMS", whatsapp: "WhatsApp" };

export const PURPOSE_LABELS: Record<TemplatePurpose, string> = {
  timesheet_reminder: "Timesheet reminder",
  onboarding_task: "Onboarding task",
  interview_reminder: "Interview reminder",
  joining_touchpoint: "Joining touchpoint",
  other_transactional: "Other (transactional)",
};

export const REASON_LABELS: Record<string, string> = {
  no_phone: "No phone number",
  opted_out: "Opted out",
  no_whatsapp_consent: "No WhatsApp opt-in",
  missing_variable: "Missing merge data",
  template_not_registered: "Template not registered",
};

export function reasonLabel(reason: string | null | undefined): string {
  if (!reason) return "";
  return REASON_LABELS[reason] ?? reason.replace(/_/g, " ");
}

/** Badge for one recipient's eligibility row. */
export function eligibilityBadge(e: Pick<Eligibility, "eligible" | "reason"> | undefined): BadgeSpec {
  if (!e) return { label: "Checking…", color: "subtle" };
  if (e.eligible) return { label: "Ready", color: "success" };
  if (e.reason === "opted_out") return { label: reasonLabel(e.reason), color: "danger" };
  if (e.reason === "missing_variable") return { label: reasonLabel(e.reason), color: "warning" };
  return { label: reasonLabel(e.reason) || "Not eligible", color: "warning" };
}

export function eligibleCount(rows: readonly Pick<Eligibility, "eligible">[] | undefined): number {
  return (rows ?? []).filter((r) => r.eligible).length;
}

export const MESSAGE_STATUS: Record<MessageStatus, BadgeSpec> = {
  queued: { label: "Queued", color: "informative" },
  deferred_quiet_hours: { label: "Waiting (quiet hours)", color: "informative" },
  sent: { label: "Sent", color: "brand" },
  delivered: { label: "Delivered", color: "success" },
  read: { label: "Read", color: "success" },
  failed: { label: "Failed", color: "danger" },
  refused: { label: "Refused", color: "danger" },
  received: { label: "Received", color: "brand" },
  manual_pending: { label: "Awaiting manual send", color: "warning" },
};

export function messageStatusBadge(status: string): BadgeSpec {
  return MESSAGE_STATUS[status as MessageStatus] ?? { label: status, color: "subtle" };
}

/** "45 s", "12 min", "3 h", "2 d". */
export function formatAge(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}

// ---------------------------------------------------------------- template validation
export const SMS_MAX_LENGTH = 1000;
export const DLT_TEMPLATE_ID = /^\d{19}$/;
export const SENDER_ID = /^[A-Za-z0-9]{6}$/;
export const WA_TEMPLATE_NAME = /^[a-z0-9_]{1,512}$/;
export const TEMPLATE_KEY = /^[a-z0-9_]{1,64}$/;

export type TemplateDraft = ChannelTemplateIn;

export function emptyTemplateDraft(channel: Channel): TemplateDraft {
  return {
    channel,
    key: "",
    name: "",
    purpose: "other_transactional",
    body: "",
    variables: [],
    provider_template_ref: null,
    language: "en",
    sender_id: null,
    status: "draft",
  };
}

export function templateToDraft(t: ChannelTemplate): TemplateDraft {
  const { channel, key, name, purpose, body, variables, provider_template_ref, language, sender_id, status } = t;
  return { channel, key, name, purpose, body, variables, provider_template_ref, language, sender_id, status };
}

/** The draft as sent to the API: trimmed refs and `variables` derived from the body's merge tokens. */
export function templatePayload(d: TemplateDraft): TemplateDraft {
  const ref = d.provider_template_ref?.trim() || null;
  const sender = d.sender_id?.trim() || null;
  return {
    ...d,
    key: d.key.trim(),
    name: d.name.trim(),
    provider_template_ref: ref,
    sender_id: d.channel === "sms" ? (sender ? sender.toUpperCase() : null) : null,
    variables: tokenPaths(d.body),
  };
}

/** Field errors for the template editor; `allowedPaths` are the known merge-field paths (when loaded). */
export function validateTemplate(d: TemplateDraft, allowedPaths?: Iterable<string>): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.name.trim()) e.name = "Enter a name";
  if (!TEMPLATE_KEY.test(d.key.trim())) e.key = "Use lowercase letters, digits and underscores";
  if (!d.body.trim()) e.body = "Enter the message text";
  const ref = d.provider_template_ref?.trim() ?? "";
  if (d.channel === "sms") {
    if (d.body.length > SMS_MAX_LENGTH) e.body = `SMS text can be at most ${SMS_MAX_LENGTH} characters (now ${d.body.length})`;
    if (ref && !DLT_TEMPLATE_ID.test(ref)) e.provider_template_ref = "The DLT template ID is exactly 19 digits";
    if (!ref && d.status === "registered") e.provider_template_ref = "A registered SMS template needs its DLT template ID";
    const sender = d.sender_id?.trim() ?? "";
    if (sender && !SENDER_ID.test(sender)) e.sender_id = "The sender ID (header) is exactly 6 letters or digits";
  } else {
    if (ref && !WA_TEMPLATE_NAME.test(ref)) e.provider_template_ref = "Use the approved template name: lowercase letters, digits and underscores";
    if (!ref && d.status === "registered") e.provider_template_ref = "A registered WhatsApp template needs its approved template name";
  }
  if (allowedPaths && !e.body) {
    const unknown = unknownPaths(d.body, allowedPaths);
    if (unknown.length) e.body = `Unknown merge field${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}`;
  }
  return e;
}

export function templateStatusBadge(t: Pick<ChannelTemplate, "status" | "sendable">): BadgeSpec {
  if (t.status === "archived") return { label: "Archived", color: "subtle" };
  if (t.status === "draft") return { label: "Draft", color: "informative" };
  return t.sendable ? { label: "Registered", color: "success" } : { label: "Registered (incomplete)", color: "warning" };
}

/** Templates offered in the send dialog: registered and sendable for the channel. */
export function sendableTemplates(list: readonly ChannelTemplate[] | undefined, channel: Channel): ChannelTemplate[] {
  return (list ?? []).filter((t) => t.channel === channel && t.status === "registered" && t.sendable);
}

// ---------------------------------------------------------------- opt-out public link
export type OptOutScreen = "confirm" | "done" | "unsupported";

export function optOutScreen(view: { purpose: string; status?: string | null }): OptOutScreen {
  if (view.purpose !== "channel_opt_out") return "unsupported";
  if (view.status === "opted_out") return "done";
  if (!view.status || view.status === "active") return "confirm";
  return "unsupported";
}

export function optOutCopy(channel: string | null | undefined, tenant: string | null | undefined) {
  const ch = channel === "whatsapp" ? "WhatsApp" : "SMS";
  const who = tenant || "this organisation";
  return {
    title: `Stop ${ch} messages from ${who}?`,
    body: `You will no longer receive ${ch} messages from ${who}. Emails and other messages are not affected. You can turn ${ch} messages back on later from the candidate portal or by asking the recruiter.`,
    action: `Stop ${ch} messages`,
    doneTitle: `You will not receive ${ch} messages`,
    doneBody: `Your choice was recorded. ${who} will no longer send you ${ch} messages.`,
  };
}

// ---------------------------------------------------------------- custom domain
export type DnsRecord = { type: "TXT" | "CNAME"; name: string; value: string; purpose: string };

export function dnsRecords(d: Pick<CustomDomain, "host" | "txt_name" | "txt_value" | "cname_target"> | null): DnsRecord[] {
  if (!d) return [];
  return [
    { type: "TXT", name: d.txt_name, value: d.txt_value, purpose: "Proves you own the domain" },
    { type: "CNAME", name: d.host, value: d.cname_target, purpose: "Points the domain at your career site" },
  ];
}

export const DOMAIN_STATUS: Record<CustomDomainStatus, BadgeSpec> = {
  pending: { label: "Waiting for DNS", color: "warning" },
  verified: { label: "Verified", color: "success" },
  failed: { label: "Verification failed", color: "danger" },
  removed: { label: "Removed", color: "subtle" },
};

export function domainStatusBadge(status: string): BadgeSpec {
  return DOMAIN_STATUS[status as CustomDomainStatus] ?? { label: status, color: "subtle" };
}

const HOST_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Normalises user input ("https://Careers.Example.in/") to a bare host, or null when invalid. */
export function normalizeHost(input: string): string | null {
  const h = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  return HOST_RE.test(h) ? h : null;
}

// ---------------------------------------------------------------- inbound reply text (never HTML)
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

/**
 * Plain text for an inbound reply. The backend already sends text, but any markup that slipped through is
 * stripped (tags, scripts and styles removed); the result is only ever rendered as a React text node, so
 * decoded entities such as `&lt;b&gt;` show literally and are never interpreted.
 */
export function replyPlainText(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, k: string) => ENTITIES[k] ?? "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** First `max` characters of a reply (cut at a word boundary) and whether anything was cut. */
export function replyPreview(text: string, max = 280): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return { text: `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`, truncated: true };
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/** Normalises an Indian-style number to E.164 (+91 default), or null when it cannot be one. */
export function toE164(input: string, defaultCountry = "91"): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  const d = digits.replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10) return `+${defaultCountry}${d}`;
  if (d.length >= 11 && d.length <= 15) return `+${d}`;
  return null;
}

// ---------------------------------------------------------------- connectors
export const PROVIDER_LABELS: Record<string, string> = {
  fake: "Fake (development)",
  manual: "Manual (operator queue)",
  msg91: "MSG91",
  meta_cloud: "Meta WhatsApp Cloud",
};

export type ProviderField = { key: string; label: string; kind: "credential" | "setting"; required: boolean; secret: boolean };

export function providerFields(provider: string): ProviderField[] {
  switch (provider) {
    case "msg91":
      return [
        { key: "auth_key", label: "Auth key", kind: "credential", required: true, secret: true },
        { key: "flow_id", label: "Flow ID (optional)", kind: "setting", required: false, secret: false },
      ];
    case "meta_cloud":
      return [
        { key: "access_token", label: "Access token", kind: "credential", required: true, secret: true },
        { key: "app_secret", label: "App secret", kind: "credential", required: true, secret: true },
        { key: "phone_number_id", label: "Phone number ID", kind: "setting", required: true, secret: false },
        { key: "waba_id", label: "WhatsApp Business Account ID", kind: "setting", required: true, secret: false },
      ];
    default:
      return [];
  }
}

/**
 * Splits form values into the write-only `credentials` and the visible `settings`. Empty credential
 * inputs are dropped (they keep the stored secret); `credentials` is omitted when nothing was entered.
 */
export function connectorPayload(provider: string, values: Record<string, string>) {
  const credentials: Record<string, string> = {};
  const settings: Record<string, unknown> = {};
  for (const f of providerFields(provider)) {
    const v = (values[f.key] ?? "").trim();
    if (f.kind === "credential") {
      if (v) credentials[f.key] = v;
    } else if (v) settings[f.key] = v;
  }
  return { credentials: Object.keys(credentials).length ? credentials : undefined, settings };
}

/** Missing required fields; credentials are only required when none are stored yet. */
export function connectorErrors(provider: string, values: Record<string, string>, hasCredentials: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  for (const f of providerFields(provider)) {
    if (!f.required) continue;
    if (f.kind === "credential" && hasCredentials) continue;
    if (!(values[f.key] ?? "").trim()) e[f.key] = `Enter the ${f.label.toLowerCase()}`;
  }
  return e;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export function quietHoursErrors(q: { start: string; end: string; tz: string }): Record<string, string> {
  const e: Record<string, string> = {};
  if (!TIME_RE.test(q.start)) e.start = "Use HH:MM (24-hour)";
  if (!TIME_RE.test(q.end)) e.end = "Use HH:MM (24-hour)";
  if (!q.tz.trim()) e.tz = "Enter a time zone";
  return e;
}
