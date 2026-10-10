/** Pure helpers for the Employee Referrals screens (Epic 42). Unit-tested in `referrals.test.ts`. */
import type {
  EligibleDemands,
  IneligibleReason,
  ProgramIn,
  ProgramOut,
  PublicReferralView,
  ReferralChannel,
  ReferralStatus,
  ReferrerStatusLabel,
  RewardRule,
  RewardStatus,
  RewardStatusLabel,
  SeniorityLevel,
} from "./types";

type BadgeColor = "brand" | "success" | "danger" | "informative" | "subtle" | "warning" | "important" | "severe";

// ---------------------------------------------------------------- statuses
export const REFERRAL_STATUSES: readonly ReferralStatus[] = [
  "submitted",
  "accepted",
  "in_process",
  "hired",
  "not_selected",
  "duplicate",
  "declined",
  "expired",
  "withdrawn",
];

/** Internal status -> the four labels a referrer sees (mirrors the backend referrer-safe schema). */
export const REFERRER_STATUS_LABELS: Record<ReferralStatus, ReferrerStatusLabel> = {
  submitted: "Received",
  accepted: "Received",
  in_process: "In process",
  hired: "Hired",
  not_selected: "Not selected",
  duplicate: "Not selected",
  declined: "Not selected",
  expired: "Not selected",
  withdrawn: "Not selected",
};

export function referrerStatusLabel(status: ReferralStatus): ReferrerStatusLabel {
  return REFERRER_STATUS_LABELS[status] ?? "Not selected";
}

export const REFERRER_STATUS_COLORS: Record<ReferrerStatusLabel, BadgeColor> = {
  Received: "informative",
  "In process": "brand",
  Hired: "success",
  "Not selected": "subtle",
};

export const REWARD_LABEL_COLORS: Record<RewardStatusLabel, BadgeColor> = {
  Pending: "informative",
  Eligible: "warning",
  Approved: "brand",
  Paid: "success",
  "Not payable": "subtle",
};

/** Internal (recruiter) labels. */
export const STATUS_LABELS: Record<ReferralStatus, string> = {
  submitted: "Waiting for referee",
  accepted: "Accepted",
  in_process: "In process",
  hired: "Hired",
  not_selected: "Not selected",
  duplicate: "Duplicate",
  declined: "Declined",
  expired: "Expired",
  withdrawn: "Withdrawn",
};

export const STATUS_COLORS: Record<ReferralStatus, BadgeColor> = {
  submitted: "informative",
  accepted: "brand",
  in_process: "brand",
  hired: "success",
  not_selected: "subtle",
  duplicate: "warning",
  declined: "subtle",
  expired: "subtle",
  withdrawn: "subtle",
};

export const CHANNEL_LABELS: Record<ReferralChannel, string> = { upload: "Resume upload", share_link: "Share link" };

export const INELIGIBLE_LABELS: Record<IneligibleReason, string> = {
  duplicate: "Already in the talent database",
  excluded_referrer: "Referrer is excluded for this opening",
  no_program: "No matching referral program",
  self_referral: "Self-referral",
};

export const REWARD_STATUSES: readonly RewardStatus[] = ["pending_condition", "eligible", "approved", "paid", "void"];

export const REWARD_STATUS_LABELS: Record<RewardStatus, string> = {
  pending_condition: "Pending",
  eligible: "Eligible",
  approved: "Approved",
  paid: "Paid",
  void: "Void",
};

export const REWARD_STATUS_COLORS: Record<RewardStatus, BadgeColor> = {
  pending_condition: "informative",
  eligible: "warning",
  approved: "brand",
  paid: "success",
  void: "subtle",
};

export function canVoidReward(status: RewardStatus | null | undefined): boolean {
  return status === "pending_condition" || status === "eligible";
}

/** "Link to opening" is offered only for an accepted referral that has no Demand (a general referral). */
export function canLinkDemand(r: { status: ReferralStatus; demand_id: string | null }): boolean {
  return r.status === "accepted" && !r.demand_id;
}

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  contract: "Contract",
  contract_to_hire: "Contract to hire",
  permanent: "Permanent",
  freelance: "Freelance",
};

export const WORK_MODE_LABELS: Record<string, string> = { onsite: "On-site", remote: "Remote", hybrid: "Hybrid" };

export const SENIORITY_LABELS: Record<SeniorityLevel, string> = { junior: "Junior", mid: "Mid", senior: "Senior" };

export function labelOf(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "—";
  return map[key] ?? key.replace(/_/g, " ");
}

// ---------------------------------------------------------------- formatting
export function formatMoney(amount: string | null | undefined, currency: string | null | undefined): string {
  if (amount == null || amount === "") return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${amount} ${currency ?? ""}`.trim();
  if (!currency) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
  }
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

// ---------------------------------------------------------------- refer form
export const RESUME_ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

export function resumeError(file: { name: string; size: number } | null | undefined): string | null {
  if (!file) return "Attach a resume.";
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".pdf") && !lower.endsWith(".docx")) return "Upload a PDF or Word (.docx) file.";
  if (file.size > MAX_RESUME_BYTES) return "The resume must be 10 MB or smaller.";
  if (file.size === 0) return "The file is empty.";
  return null;
}

export type ReferForm = {
  name: string;
  email: string;
  phone: string;
  relationship: string;
  note: string;
  resume: { name: string; size: number } | null;
};

export const EMPTY_REFER_FORM: ReferForm = { name: "", email: "", phone: "", relationship: "", note: "", resume: null };

export const SELF_REFERRAL_MESSAGE = "You cannot refer yourself";

/** Client-side validation of the refer form; `selfEmail` is the signed-in referrer's email (if known). */
export function referFormErrors(form: ReferForm, selfEmail?: string | null): Partial<Record<keyof ReferForm, string>> {
  const errors: Partial<Record<keyof ReferForm, string>> = {};
  if (!form.name.trim()) errors.name = "Enter your friend's name.";
  const email = form.email.trim();
  if (!email) errors.email = "Enter your friend's email address.";
  else if (!isEmail(email)) errors.email = "Enter a valid email address, like name@example.com.";
  else if (selfEmail && email.toLowerCase() === selfEmail.trim().toLowerCase()) errors.email = SELF_REFERRAL_MESSAGE;
  const r = resumeError(form.resume);
  if (r) errors.resume = r;
  return errors;
}

/** User-facing copy for refer / withdraw API errors. */
export function referErrorMessage(e: { status?: number; code?: string; message?: string } | null | undefined): string {
  switch (e?.code) {
    case "self_referral":
      return SELF_REFERRAL_MESSAGE;
    case "referrer_not_eligible":
      return "You work on this opening. Add the candidate through sourcing instead.";
    case "referral_exists":
      return "This person has already been referred for this opening.";
    case "demand_not_accepting":
      return "This opening is no longer accepting referrals.";
    case "unsupported_file_type":
      return "Upload a PDF or Word (.docx) file.";
    case "file_too_large":
      return "The resume must be 10 MB or smaller.";
    case "referral_not_withdrawable":
      return "This referral can no longer be withdrawn.";
    case "not_a_worker":
      return "Referrals are available once you have a placement with us.";
    default:
      if (e?.status === 0) return "Cannot reach the server. Check your connection and try again.";
      return e?.message || "Something went wrong. Please try again.";
  }
}

// ---------------------------------------------------------------- public referee page
export type PublicReferralScreen =
  | "accept_notice"
  | "submit_form"
  | "answered"
  | "accepted"
  | "declined"
  | "received";

/** Which variant of the public referral page to render from the view payload (plus the local outcome, if any). */
export function publicReferralScreen(
  view: Pick<PublicReferralView, "mode" | "status">,
  outcome?: "accepted" | "declined" | "received" | null,
): PublicReferralScreen {
  if (outcome) return outcome;
  if (view.status !== "open") return "answered";
  return view.mode === "accept" ? "accept_notice" : "submit_form";
}

/** Copy for a public-link API error; `fatal` errors replace the whole page. */
export function publicReferralError(e: { status?: number; code?: string; message?: string } | null | undefined): {
  title: string;
  body: string;
  fatal: boolean;
} {
  const status = e?.status ?? 500;
  const code = e?.code;
  if (code === "link_used") return { title: "This link has already been used", body: "There is nothing more to do on this page.", fatal: true };
  if (status === 410 || code === "link_expired")
    return { title: "This link has expired or was already used", body: "Ask the person who referred you to send a new link.", fatal: true };
  if (status === 404) return { title: "This link is not valid", body: "Open the link from the email you received.", fatal: true };
  if (code === "referral_answered")
    return { title: "You have already answered", body: "Your earlier answer was recorded. There is nothing more to do.", fatal: true };
  if (code === "referral_exists")
    return { title: "You were already referred", body: "Your details are already with the recruiting team for this opening.", fatal: false };
  if (code === "notice_outdated")
    return { title: "The notice was updated", body: "Reload the page to read the latest version, then try again.", fatal: false };
  if (code === "challenge_failed") return { title: "Security check failed", body: "Complete the security check and try again.", fatal: false };
  if (status === 429) return { title: "Too many attempts", body: "Wait a few minutes and try again.", fatal: false };
  if (status === 422) return { title: "Check your details", body: e?.message || "Some details are not valid.", fatal: false };
  if (status === 0) return { title: "Cannot reach the server", body: "Check your connection and try again.", fatal: false };
  return { title: "Something went wrong", body: "Please try again.", fatal: false };
}

/** Public self-submit validation (share channel). */
export function selfSubmitErrors(form: { name: string; email: string; resume: { name: string; size: number } | null; agreed: boolean }) {
  const errors: Partial<Record<"name" | "email" | "resume" | "agreed", string>> = {};
  if (!form.name.trim()) errors.name = "Enter your name.";
  if (!form.email.trim()) errors.email = "Enter your email address.";
  else if (!isEmail(form.email)) errors.email = "Enter a valid email address, like name@example.com.";
  const r = resumeError(form.resume);
  if (r) errors.resume = r;
  if (!form.agreed) errors.agreed = "Tick the box to agree to the notice.";
  return errors;
}

// ---------------------------------------------------------------- recruiter list
export type ReferralFilters = { status: string; demand_id: string; program_id: string; channel: string };
export const EMPTY_FILTERS: ReferralFilters = { status: "", demand_id: "", program_id: "", channel: "" };

export function referralQuery(f: ReferralFilters, limit: number, offset: number): string {
  const p = new URLSearchParams();
  if (f.status) p.set("status", f.status);
  if (f.demand_id) p.set("demand_id", f.demand_id);
  if (f.program_id) p.set("program_id", f.program_id);
  if (f.channel) p.set("channel", f.channel);
  p.set("limit", String(limit));
  p.set("offset", String(offset));
  return `?${p.toString()}`;
}

// ---------------------------------------------------------------- programs
export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function emptyProgram(now = new Date()): ProgramIn {
  return {
    name: "",
    active: true,
    valid_from: todayIso(now),
    valid_to: null,
    eligible_referrers: "both",
    eligible_demands: { all: true, client_ids: [], demand_ids: [], employment_types: [], seniority_levels: [] },
    reward_rules: [],
    default_amount: null,
    currency: "INR",
    joining_condition_days: 90,
    exclusions: { assigned_recruiters: true, demand_owner: true, excluded_role_keys: [] },
    priority: 0,
  };
}

export function programToInput(p: ProgramOut): ProgramIn {
  return {
    name: p.name,
    active: p.active,
    valid_from: p.valid_from,
    valid_to: p.valid_to,
    eligible_referrers: p.eligible_referrers,
    eligible_demands: { ...p.eligible_demands },
    reward_rules: p.reward_rules.map((r) => ({ match: { ...r.match }, amount: r.amount, currency: r.currency })),
    default_amount: p.default_amount,
    currency: p.currency,
    joining_condition_days: p.joining_condition_days,
    exclusions: { ...p.exclusions, excluded_role_keys: [...p.exclusions.excluded_role_keys] },
    priority: p.priority,
  };
}

export type RuleMatchKey = "seniority_level" | "demand_id" | "employment_type";

const MATCH_KEYS: readonly RuleMatchKey[] = ["seniority_level", "demand_id", "employment_type"];

/** The match dimension a rule uses (a key present on `match`, even while its value is still empty). */
export function ruleMatchKey(rule: RewardRule): RuleMatchKey | null {
  return MATCH_KEYS.find((k) => rule.match[k]) ?? MATCH_KEYS.find((k) => k in rule.match) ?? null;
}

export function isMoney(v: string): boolean {
  return /^\d{1,12}(\.\d{1,2})?$/.test(v.trim()) && Number(v) > 0;
}

/** Client-side checks that mirror the backend's 422s for a program. */
export function programErrors(p: ProgramIn): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!p.name.trim()) errors.name = "Enter a name.";
  if (!p.valid_from) errors.valid_from = "Choose a start date.";
  if (p.valid_to && p.valid_from && p.valid_to < p.valid_from) errors.valid_to = "The end date must be on or after the start date.";
  if (!/^[A-Z]{3}$/.test(p.currency)) errors.currency = "Use a 3-letter currency code, like INR.";
  if (p.default_amount && !isMoney(p.default_amount)) errors.default_amount = "Enter an amount greater than 0 with up to 2 decimals.";
  if (!Number.isInteger(p.joining_condition_days) || p.joining_condition_days < 0 || p.joining_condition_days > 730)
    errors.joining_condition_days = "Enter 0 to 730 days.";
  if (!Number.isInteger(p.priority) || p.priority < -1000 || p.priority > 1000) errors.priority = "Enter -1000 to 1000.";
  if (!p.eligible_demands.all && !hasDemandScope(p.eligible_demands))
    errors.eligible_demands = "Choose at least one client, opening, employment type or seniority level, or turn on all openings.";
  const seen = new Set<string>();
  p.reward_rules.forEach((r, i) => {
    const key = ruleMatchKey(r);
    if (!key || !r.match[key]) errors[`rule_${i}`] = "Choose what this rule matches.";
    else {
      const sig = `${key}:${String(r.match[key])}`;
      if (seen.has(sig)) errors[`rule_${i}`] = "Another rule already matches this.";
      seen.add(sig);
    }
    if (!isMoney(r.amount)) errors[`rule_${i}_amount`] = "Enter an amount greater than 0.";
    if (!/^[A-Z]{3}$/.test(r.currency)) errors[`rule_${i}_currency`] = "3-letter code.";
  });
  return errors;
}

export function hasDemandScope(d: EligibleDemands): boolean {
  return d.client_ids.length + d.demand_ids.length + d.employment_types.length + d.seniority_levels.length > 0;
}

/** Normalise the editor state into the API payload (single match key per rule, trimmed strings). */
export function cleanProgram(p: ProgramIn): ProgramIn {
  return {
    ...p,
    name: p.name.trim(),
    valid_to: p.valid_to || null,
    default_amount: p.default_amount?.trim() ? p.default_amount.trim() : null,
    currency: p.currency.trim().toUpperCase(),
    eligible_demands: p.eligible_demands.all
      ? { all: true, client_ids: [], demand_ids: [], employment_types: [], seniority_levels: [] }
      : { ...p.eligible_demands, all: false },
    reward_rules: p.reward_rules.map((r) => {
      const key = ruleMatchKey(r);
      return { match: key ? { [key]: r.match[key] } : {}, amount: r.amount.trim(), currency: r.currency.trim().toUpperCase() };
    }),
    exclusions: {
      ...p.exclusions,
      excluded_role_keys: p.exclusions.excluded_role_keys.map((k) => k.trim()).filter(Boolean),
    },
  };
}
