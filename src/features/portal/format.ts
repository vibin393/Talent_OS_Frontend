/** Pure helpers of the Candidate Portal (Epic 9, B4). */
import type { PortalInterview } from "@/lib/api/types";

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  // Date-only values ("2026-10-01") are calendar dates: format them in UTC so they do not shift a day.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = new Date(dateOnly ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { dateStyle: "medium", ...(dateOnly ? { timeZone: "UTC" } : {}) });
}

export function formatDateTime(iso: string | null | undefined, timeZone?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", ...(timeZone ? { timeZone, timeZoneName: "short" } : {}) });
  } catch {
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }
}

// ------------------------------------------------------------------ offers
/** Normalise a typed name for comparison: NFKC, collapsed whitespace, case-insensitive. */
export function normalizeName(name: string): string {
  return name.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

/** True when the typed signature matches the name on the offer (the API re-checks it). */
export function namesMatch(typed: string, expected: string | null | undefined): boolean {
  const t = normalizeName(typed);
  if (!t) return false;
  return expected ? t === normalizeName(expected) : true;
}

const UNIT_LABELS: Record<string, string> = { hour: "per hour", day: "per day", month: "per month", year: "per year", annual: "per year", monthly: "per month", daily: "per day", hourly: "per hour" };

export function formatMoney(m: { amount?: string | null; currency?: string | null } | null | undefined, unit?: string | null): string {
  if (!m?.amount) return "—";
  const n = Number(m.amount);
  let text: string;
  try {
    text = m.currency && Number.isFinite(n) ? n.toLocaleString(undefined, { style: "currency", currency: m.currency, maximumFractionDigits: 2 }) : `${m.currency ?? ""} ${m.amount}`.trim();
  } catch {
    text = `${m.currency ?? ""} ${m.amount}`.trim();
  }
  return unit ? `${text} ${UNIT_LABELS[unit] ?? `per ${unit}`}` : text;
}

export const OFFER_STATUS_LABELS: Record<string, string> = {
  released: "Waiting for your response",
  viewed: "Waiting for your response",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  withdrawn: "Withdrawn",
};

// ------------------------------------------------------------------ privacy
export const CONSENT_PURPOSE_LABELS: Record<string, string> = {
  data_processing: "Processing my data for recruitment",
  ai_processing: "AI processing (e.g. reading my resume)",
  marketing: "News about other jobs",
  client_submission: "Sharing my profile with a client",
  // Epic 35 purposes.
  bgv: "Background verification",
  reference_check: "Contacting my references",
  vendor_collection: "My vendor sharing my details",
  whatsapp: "WhatsApp messages",
  engagement: "Engagement (required while you are on assignment)",
};

/** Purposes shown for information only (never withdrawn from the portal). */
export const READ_ONLY_PURPOSES: readonly string[] = ["engagement"];

export const CONSENT_STATUS_LABELS: Record<string, string> = {
  granted: "Given",
  active: "Given",
  withdrawn: "Withdrawn",
  expired: "Expired",
  declined: "Declined",
};

export const REGRANTABLE = ["ai_processing", "marketing"] as const;

export const EXPORT_STATUS: Record<string, { label: string; color: "informative" | "success" | "danger" | "subtle" }> = {
  queued: { label: "Preparing", color: "informative" },
  running: { label: "Preparing", color: "informative" },
  ready: { label: "Ready to download", color: "success" },
  failed: { label: "Failed", color: "danger" },
  expired: { label: "Expired", color: "subtle" },
};

export const DSR_KIND_LABELS: Record<string, string> = { access: "Copy of my data", correction: "Correction", erasure: "Erasure" };

export const DSR_STATUS: Record<string, { label: string; color: "informative" | "warning" | "success" | "subtle" }> = {
  open: { label: "Open", color: "informative" },
  in_progress: { label: "In progress", color: "warning" },
  completed: { label: "Completed", color: "success" },
  rejected: { label: "Rejected", color: "subtle" },
};

/** Profile fields a correction request can name (`fields` of the DSR). */
export const CORRECTION_FIELDS: { value: string; label: string }[] = [
  { value: "full_name", label: "Name" },
  { value: "emails", label: "Email address" },
  { value: "phones", label: "Phone number" },
  { value: "location", label: "Location" },
  { value: "employment", label: "Work history" },
  { value: "education", label: "Education" },
  { value: "skills", label: "Skills" },
  { value: "other", label: "Something else" },
];

// ------------------------------------------------------------------ interviews: add to calendar
function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold content lines at 75 octets (RFC 5545 §3.1), approximated by characters. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 74) parts.push((i === 0 ? "" : " ") + line.slice(i, i + 74));
  return parts.join("\r\n");
}

/** An iCalendar (.ics) file for one interview, generated in the browser (no server round trip). */
export function buildIcs(interview: PortalInterview, orgName: string, now = new Date()): string {
  const start = new Date(interview.starts_at);
  const end = interview.ends_at ? new Date(interview.ends_at) : new Date(start.getTime() + 60 * 60 * 1000);
  const summary = [interview.title, interview.round_name].filter(Boolean).join(" – ");
  const where = interview.join_url ?? interview.location ?? "";
  const description = [`Interview with ${orgName}.`, interview.join_url ? `Join: ${interview.join_url}` : null].filter(Boolean).join("\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Talent OS//Candidate Portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${interview.id}@talent-os`,
    `DTSTAMP:${icsDate(now.toISOString())}`,
    `DTSTART:${icsDate(start.toISOString())}`,
    `DTEND:${icsDate(end.toISOString())}`,
    `SUMMARY:${icsText(summary)}`,
    where ? `LOCATION:${icsText(where)}` : null,
    `DESCRIPTION:${icsText(description)}`,
    interview.join_url ? `URL:${icsText(interview.join_url)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => l !== null);
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export function icsFileName(interview: PortalInterview): string {
  const base = interview.title.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "interview";
  return `${base}.ics`;
}

// ------------------------------------------------------------------ remembered tenant (for sign-in redirects)
const TENANT_KEY = "portal-tenant";

export function rememberTenant(slug: string): void {
  try {
    window.localStorage.setItem(TENANT_KEY, slug);
  } catch {
    // storage unavailable: the sign-in page asks for the organisation instead
  }
}

export function rememberedTenant(): string | null {
  try {
    return window.localStorage.getItem(TENANT_KEY);
  } catch {
    return null;
  }
}

export function signInUrl(slug: string | null | undefined): string {
  return slug ? `/portal/sign-in?tenant=${encodeURIComponent(slug)}` : "/portal/sign-in";
}

/** The `t` parameter of a `#t=<token>` fragment ("" if absent). */
export function tokenFromFragment(hash: string | null | undefined): string {
  const raw = (hash ?? "").replace(/^#/, "");
  if (!raw) return "";
  try {
    return (new URLSearchParams(raw).get("t") ?? "").trim();
  } catch {
    return "";
  }
}
