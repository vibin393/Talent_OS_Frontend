/** Pure display helpers for candidates (ids, compensation with masking, location, experience, labels). */
import type {
  AttachmentCategory,
  Candidate360Out,
  CandidateSource,
  CompensationUnit,
  ImportItemStatus,
  LocationIn,
  LocationOut,
  ParseStatus,
} from "@/lib/api/types";

export const EMPTY = "—";
export const HIDDEN = "Hidden";

/** `CAN-000042` from a number, or a normalised (trimmed, upper-case) human id string. */
export function formatHumanId(value: string | number | null | undefined, prefix = "CAN", width = 6): string {
  if (value === null || value === undefined || value === "") return EMPTY;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return EMPTY;
    return `${prefix}-${String(Math.floor(value)).padStart(width, "0")}`;
  }
  return value.trim().toUpperCase();
}

export const UNIT_LABELS: Record<CompensationUnit, string> = {
  annual: "per year",
  monthly: "per month",
  daily: "per day",
  hourly: "per hour",
};

export const COMPENSATION_UNITS = Object.keys(UNIT_LABELS) as CompensationUnit[];

type CompensationSource = Pick<
  Candidate360Out,
  | "current_ctc_amount"
  | "current_ctc_currency"
  | "current_ctc_unit"
  | "expected_ctc_amount"
  | "expected_ctc_currency"
  | "expected_ctc_unit"
  | "masked_fields"
>;

/** True when the API masked this compensation group for the viewer (no `compensation:view`). */
export function isCompensationMasked(c: Pick<Candidate360Out, "masked_fields">, kind: "current" | "expected"): boolean {
  return (c.masked_fields ?? []).some((f) => f.startsWith(`${kind}_ctc_`));
}

/** Format an amount with its currency (falls back to "<amount> <CUR>" for unknown currency codes). */
export function formatMoney(amount: string | number, currency: string | null | undefined, locale?: string): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  const cur = (currency ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(cur)) {
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(n);
    } catch {
      // unknown ISO code: fall through
    }
  }
  const plain = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);
  return cur ? `${plain} ${cur}` : plain;
}

/** "₹12,00,000.00 per year", "Hidden" when masked, "—" when not set. */
export function formatCompensation(c: CompensationSource, kind: "current" | "expected", locale?: string): string {
  if (isCompensationMasked(c, kind)) return HIDDEN;
  const amount = kind === "current" ? c.current_ctc_amount : c.expected_ctc_amount;
  if (amount === null || amount === undefined || amount === "") return EMPTY;
  const currency = kind === "current" ? c.current_ctc_currency : c.expected_ctc_currency;
  const unit = kind === "current" ? c.current_ctc_unit : c.expected_ctc_unit;
  const money = formatMoney(amount, currency, locale);
  return unit ? `${money} ${UNIT_LABELS[unit]}` : money;
}

/** "Pune, Maharashtra, India" (empty parts skipped). */
export function formatLocation(loc: LocationOut | LocationIn | null | undefined): string {
  if (!loc) return EMPTY;
  const parts = [loc.city, loc.state, loc.country].map((p) => (p ?? "").trim()).filter(Boolean);
  return parts.length ? parts.join(", ") : EMPTY;
}

/** "5 yrs 3 mos", "8 mos", "1 yr". */
export function formatExperience(months: number | null | undefined): string {
  if (months === null || months === undefined || !Number.isFinite(months) || months < 0) return EMPTY;
  const y = Math.floor(months / 12);
  const m = Math.round(months % 12);
  const parts: string[] = [];
  if (y) parts.push(`${y} yr${y === 1 ? "" : "s"}`);
  if (m || !y) parts.push(`${m} mo${m === 1 ? "" : "s"}`);
  return parts.join(" ");
}

/** "Senior Engineer @ Infosys", either part optional. */
export function formatRole(title: string | null | undefined, employer: string | null | undefined): string {
  const t = (title ?? "").trim();
  const e = (employer ?? "").trim();
  if (t && e) return `${t} @ ${e}`;
  return t || e || EMPTY;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return EMPTY;
  // Date-only values are shown as-is in the user's locale without a timezone shift.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  return Number.isNaN(d.getTime()) ? EMPTY : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return EMPTY;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const SOURCE_LABELS: Record<CandidateSource, string> = {
  manual: "Manual",
  resume_upload: "Resume upload",
  bulk_import: "Bulk import",
  career_portal: "Career portal",
  referral: "Referral",
  job_board: "Job board",
  other: "Other",
};

export const SOURCES = Object.keys(SOURCE_LABELS) as CandidateSource[];

export const PARSE_STATUS: Record<ParseStatus, { label: string; intent: "success" | "warning" | "error" | "info" }> = {
  parsed: { label: "Parsed", intent: "success" },
  failed_manual: { label: "Parse failed – manual entry", intent: "error" },
  unavailable: { label: "AI unavailable – fill manually", intent: "warning" },
  skipped_disabled: { label: "AI parsing disabled", intent: "info" },
  skipped_consent: { label: "AI parsing not permitted (consent)", intent: "warning" },
};

export const ATTACHMENT_CATEGORY_LABELS: Record<AttachmentCategory, string> = {
  certificate: "Certificate",
  id_proof: "ID proof",
  offer_letter: "Offer letter",
  relieving_letter: "Relieving letter",
  payslip: "Payslip",
  other: "Other",
};

export const ATTACHMENT_CATEGORIES = Object.keys(ATTACHMENT_CATEGORY_LABELS) as AttachmentCategory[];

export const IMPORT_ITEM_STATUS: Record<
  ImportItemStatus,
  { label: string; color: "informative" | "success" | "warning" | "danger" | "brand" | "subtle" }
> = {
  queued: { label: "Queued", color: "subtle" },
  processing: { label: "Processing", color: "informative" },
  created: { label: "Created", color: "success" },
  linked: { label: "Linked", color: "brand" },
  needs_review: { label: "Needs review", color: "warning" },
  failed: { label: "Failed", color: "danger" },
};

export const DUPLICATE_REASON_LABELS: Record<string, string> = {
  email: "Same email",
  phone: "Same phone",
  link: "Same profile link",
  exact_email: "Same email",
  exact_phone: "Same phone",
  exact_link: "Same profile link",
  fuzzy_name_employer: "Similar name and employer",
  fuzzy_name_city: "Similar name and city",
};

export function duplicateReasonLabel(reason: string): string {
  return DUPLICATE_REASON_LABELS[reason] ?? reason.replace(/_/g, " ");
}

export const AI_FEATURE_LABELS: Record<string, string> = {
  demand_intake: "Demand intake",
  jd_generation: "Job description generation",
  resume_parsing: "Resume parsing",
  nl_search: "Natural-language search",
  matching: "Matching",
  ai_screening: "AI screening",
};

export function aiFeatureLabel(key: string): string {
  return AI_FEATURE_LABELS[key] ?? key.replace(/_/g, " ");
}
