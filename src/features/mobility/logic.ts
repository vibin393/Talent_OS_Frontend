/** Pure helpers for Internal Mobility (Epic 41). No React here so vitest can run them in node. */
import type { ApiError } from "@/lib/api/errors";
import type { MatchSection, MobilityStatus, OpeningFilters, OpeningRulesIn, OpeningRulesOut, TransferContextOut } from "./types";

export const MOBILITY_MANAGE = "mobility:manage";
export const MOBILITY_TRANSFER = "mobility:transfer";

export const MOBILITY_STATUSES: MobilityStatus[] = [
  "applied",
  "manager_approval",
  "approved",
  "manager_rejected",
  "withdrawn",
  "transfer_confirmed",
];

export const STATUS_LABELS: Record<MobilityStatus, string> = {
  applied: "Applied",
  manager_approval: "Waiting for manager approval",
  approved: "Approved by manager",
  manager_rejected: "Not approved",
  withdrawn: "Withdrawn",
  transfer_confirmed: "Transfer confirmed",
};

export type BadgeColor = "brand" | "informative" | "success" | "warning" | "danger" | "subtle";

export const STATUS_COLORS: Record<MobilityStatus, BadgeColor> = {
  applied: "informative",
  manager_approval: "warning",
  approved: "brand",
  manager_rejected: "danger",
  withdrawn: "subtle",
  transfer_confirmed: "success",
};

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return STATUS_LABELS[status as MobilityStatus] ?? status.replace(/_/g, " ");
}

export function statusColor(status: string | null | undefined): BadgeColor {
  return STATUS_COLORS[status as MobilityStatus] ?? "informative";
}

/** "Fit 82%" or "Not scored yet". */
export function fitBadgeText(fitPct: number | null | undefined): string {
  return fitPct == null ? "Not scored yet" : `Fit ${Math.round(fitPct)}%`;
}

/** Eligibility reasons as display lines (deduplicated, blank ones dropped, a fallback when none are given). */
export function eligibilityReasonLines(eligible: boolean, reasons: readonly string[] | null | undefined): string[] {
  if (eligible) return [];
  const lines = [...new Set((reasons ?? []).map((r) => r.trim()).filter(Boolean))];
  return lines.length > 0 ? lines : ["You do not meet the eligibility rules for this opening."];
}

export function eligibilityTitle(eligible: boolean): string {
  return eligible ? "You are eligible" : "You are not eligible for this opening";
}

// ---------------------------------------------------------------- dates
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/** `YYYY-MM-DD` for a `Date` built in UTC (no local-offset drift). */
function utcIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The current assignment's last working day = effective date − 1 day (calendar arithmetic in UTC). */
export function lastWorkingDayFor(effectiveDateIso: string): string | null {
  const m = ISO_DATE.exec(effectiveDateIso ?? "");
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() - 1);
  return utcIso(d);
}

/** A DatePicker's local `Date` as `YYYY-MM-DD` (its local calendar day). */
export function dateToIso(d: Date | null | undefined): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `YYYY-MM-DD` as a local-midnight `Date` (for a DatePicker value / minDate). */
export function isoToDate(iso: string | null | undefined): Date | null {
  const m = ISO_DATE.exec(iso ?? "");
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Locale display of a date-only or date-time ISO string. */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = iso.length === 10 ? isoToDate(iso) : new Date(iso);
  return !d || Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

// ---------------------------------------------------------------- matching sections
/** Sections ordered by `order`, then label; empty input → []. */
export function sortSections<T>(sections: readonly MatchSection<T>[] | null | undefined): MatchSection<T>[] {
  return [...(sections ?? [])].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

export function sectionHeader(section: Pick<MatchSection, "label" | "total">): string {
  return `${section.label} (${section.total})`;
}

/** The optional `sections` of a match list response (absent on older backends). */
export function matchSectionsOf<T>(data: unknown): MatchSection<T>[] {
  if (!data || typeof data !== "object") return [];
  const s = (data as { sections?: unknown }).sections;
  return Array.isArray(s) ? sortSections(s as MatchSection<T>[]) : [];
}

// ---------------------------------------------------------------- board query
export const DEFAULT_PAGE_SIZE = 20;

export function emptyFilters(): OpeningFilters {
  return { q: "", location: "", includeIneligible: false, page: 1, pageSize: DEFAULT_PAGE_SIZE };
}

export function openingQuery(f: OpeningFilters): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.location.trim()) p.set("location", f.location.trim());
  if (f.includeIneligible) p.set("include_ineligible", "true");
  p.set("page", String(f.page));
  p.set("page_size", String(f.pageSize));
  return `?${p.toString()}`;
}

// ---------------------------------------------------------------- apply
export type ApplyForm = { disclosureAck: boolean; coverNote: string };
export const COVER_NOTE_MAX = 4000;

export function applyFormErrors(f: ApplyForm): Partial<Record<keyof ApplyForm, string>> {
  const e: Partial<Record<keyof ApplyForm, string>> = {};
  if (!f.disclosureAck) e.disclosureAck = "Confirm that you have read and understood the disclosure.";
  if (f.coverNote.length > COVER_NOTE_MAX) e.coverNote = `Keep the note under ${COVER_NOTE_MAX} characters.`;
  return e;
}

export function canSubmitApply(f: ApplyForm): boolean {
  return Object.keys(applyFormErrors(f)).length === 0;
}

type ErrLike = Pick<ApiError, "code" | "message"> & { details?: Record<string, unknown> };

/** User-facing message for an apply / withdraw / transfer error code. */
export function mobilityErrorMessage(e: ErrLike | null | undefined): string {
  switch (e?.code) {
    case "not_eligible":
      return "You are not eligible for this opening.";
    case "manager_unresolved":
      return "We could not find a manager to approve this application. Contact HR.";
    case "disclosure_required":
      return "Confirm that you have read and understood the disclosure.";
    case "application_exists":
      return "You have already applied for this opening.";
    case "manager_approval_pending":
      return "This internal application is waiting for manager approval and cannot be moved yet.";
    case "not_selected":
      return "The candidate must be at the Selected stage before the transfer can be confirmed.";
    case "offboarding_in_progress":
      return "The current placement already has offboarding in progress.";
    case "extension_open":
      return "The current placement has an open extension. Resolve it first.";
    case "placement_not_active":
      return "The current placement is not active.";
    case "effective_date_invalid":
      return "Choose a valid effective date (on or after the earliest allowed date).";
    case "human_only_action":
      return "A transfer must be confirmed by a person, not an automation.";
    default:
      return e?.message || "Something went wrong. Please try again.";
  }
}

/** `details.reasons` of a 409 `not_eligible`, if any. */
export function errorReasons(e: { details?: Record<string, unknown> } | null | undefined): string[] {
  const r = e?.details?.reasons;
  return Array.isArray(r) ? r.filter((x): x is string => typeof x === "string") : [];
}

// ---------------------------------------------------------------- rules editor
export type RulesForm = { minTenure: string; grades: string; locations: string; note: string };

export function splitList(s: string): string[] {
  return [...new Set(s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean))];
}

export function rulesToForm(r: OpeningRulesOut | null | undefined): RulesForm {
  return {
    minTenure: r?.min_tenure_months == null ? "" : String(r.min_tenure_months),
    grades: (r?.grades ?? []).join(", "),
    locations: (r?.locations ?? []).join(", "),
    note: r?.note ?? "",
  };
}

export function rulesFormErrors(f: RulesForm): Partial<Record<keyof RulesForm, string>> {
  const e: Partial<Record<keyof RulesForm, string>> = {};
  if (f.minTenure.trim()) {
    const n = Number(f.minTenure);
    if (!Number.isInteger(n) || n < 0 || n > 600) e.minTenure = "Enter whole months between 0 and 600.";
  }
  if (f.note.length > 2000) e.note = "Keep the note under 2000 characters.";
  return e;
}

export function rulesFromForm(f: RulesForm, businessUnitIds: string[] | null = null): OpeningRulesIn {
  const grades = splitList(f.grades);
  const locations = splitList(f.locations);
  return {
    min_tenure_months: f.minTenure.trim() ? Number(f.minTenure) : null,
    grades: grades.length ? grades : null,
    locations: locations.length ? locations : null,
    business_unit_ids: businessUnitIds,
    note: f.note.trim() || null,
  };
}

// ---------------------------------------------------------------- transfer form
export type TransferForm = {
  effectiveDate: string;
  roleTitle: string;
  teamId: string;
  note: string;
  currency: string;
  rateUnit: string;
  payRate: string;
  billRate: string;
  burdenPct: string;
};

export function transferFormFrom(ctx: TransferContextOut): TransferForm {
  const p = ctx.current_placement;
  return {
    effectiveDate: ctx.earliest_effective_date,
    roleTitle: p?.role_title ?? ctx.demand_title ?? "",
    teamId: "",
    note: "",
    currency: p?.currency ?? "",
    rateUnit: p?.rate_unit ?? "",
    payRate: p?.pay_rate ?? "",
    billRate: p?.bill_rate ?? "",
    burdenPct: p?.burden_pct ?? "",
  };
}

const MONEY = /^\d{1,12}(\.\d{1,2})?$/;

export function transferFormErrors(f: TransferForm, ctx: Pick<TransferContextOut, "earliest_effective_date" | "employee_kind">) {
  const e: Partial<Record<keyof TransferForm, string>> = {};
  if (!ISO_DATE.test(f.effectiveDate)) e.effectiveDate = "Choose the effective date.";
  else if (f.effectiveDate < ctx.earliest_effective_date) e.effectiveDate = `The earliest effective date is ${formatDay(ctx.earliest_effective_date)}.`;
  if (ctx.employee_kind === "worker") {
    if (f.currency && !/^[A-Z]{3}$/.test(f.currency)) e.currency = "Use a 3-letter currency code.";
    if (f.payRate && !MONEY.test(f.payRate)) e.payRate = "Enter an amount with up to 2 decimals.";
    if (f.billRate && !MONEY.test(f.billRate)) e.billRate = "Enter an amount with up to 2 decimals.";
    if (f.burdenPct && (!/^\d{1,3}(\.\d{1,2})?$/.test(f.burdenPct) || Number(f.burdenPct) > 100)) e.burdenPct = "Enter a percentage between 0 and 100.";
  }
  if (f.teamId && !/^[0-9a-f-]{36}$/i.test(f.teamId)) e.teamId = "Choose a valid team.";
  return e;
}
