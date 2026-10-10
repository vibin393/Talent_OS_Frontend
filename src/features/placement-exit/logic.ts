/**
 * Pure helpers of the Epic 31 UI (extension, conversion, offboarding). Kept React-free for Vitest.
 */
import { isApiError } from "@/lib/api/errors";
import type {
  CaseReason,
  CaseStatus,
  CheckResult,
  CheckStatus,
  ExtensionPreviewOut,
  ExtensionStatus,
  ItemStatus,
  OffboardingItemOut,
  OwnerRole,
  TemplateItem,
} from "./types";

export type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";

// ---------------------------------------------------------------- labels
export const EXTENSION_STATUS_LABELS: Record<ExtensionStatus, string> = {
  proposed: "Proposed",
  pending_approval: "Pending approval",
  pending_client_confirmation: "Awaiting client",
  confirmed: "Confirmed",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

export const EXTENSION_STATUS_COLORS: Record<ExtensionStatus, BadgeColor> = {
  proposed: "informative",
  pending_approval: "warning",
  pending_client_confirmation: "warning",
  confirmed: "success",
  declined: "danger",
  withdrawn: "subtle",
};

export const CASE_REASON_LABELS: Record<CaseReason, string> = {
  end_of_term: "End of term",
  client_termination: "Client termination",
  worker_resignation: "Worker resignation",
  converted: "Converted to hire",
  misconduct: "Misconduct",
  other: "Other",
};

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  initiated: "Initiated",
  in_progress: "In progress",
  ready_to_close: "Ready to close",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const CASE_STATUS_COLORS: Record<CaseStatus, BadgeColor> = {
  initiated: "informative",
  in_progress: "warning",
  ready_to_close: "success",
  closed: "subtle",
  cancelled: "subtle",
};

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  pending: "Pending",
  done: "Done",
  waived: "Waived",
  not_applicable: "Not applicable",
};

export const ITEM_STATUS_COLORS: Record<ItemStatus, BadgeColor> = {
  pending: "warning",
  done: "success",
  waived: "informative",
  not_applicable: "subtle",
};

export const OWNER_ROLE_LABELS: Record<OwnerRole, string> = {
  account_manager: "Account manager",
  recruiter: "Recruiter",
  hr: "HR",
  finance: "Finance",
  payroll: "Payroll",
};

export const CHECK_COLORS: Record<CheckStatus, BadgeColor> = { pass: "success", warn: "warning", fail: "danger" };

export function ownerLabel(role: string | null | undefined): string {
  if (!role) return "Unassigned";
  return OWNER_ROLE_LABELS[role as OwnerRole] ?? humanize(role);
}

export function humanize(s: string): string {
  const t = s.replace(/_/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : s;
}

// ---------------------------------------------------------------- ending soon
/** Days-left badge colour: danger ≤ 15, warning ≤ 30, else informative. */
export function daysLeftColor(days: number): BadgeColor {
  if (days <= 15) return "danger";
  if (days <= 30) return "warning";
  return "informative";
}

export function daysLeftLabel(days: number): string {
  if (days < 0) return `${-days} d overdue`;
  if (days === 0) return "Ends today";
  return days === 1 ? "1 day" : `${days} days`;
}

// ---------------------------------------------------------------- dates
function utcDay(iso: string): number | null {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Whole days from `from` to `to` (ISO dates); null if either is missing/invalid. */
export function daysBetween(from: string | null | undefined, to: string | null | undefined): number | null {
  if (!from || !to) return null;
  const a = utcDay(from);
  const b = utcDay(to);
  if (a === null || b === null) return null;
  return Math.round(b - a);
}

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------- early termination
export type ShortfallPreview =
  | { kind: "invalid"; message: string }
  | { kind: "known"; daysGiven: number; noticePeriod: number; shortfall: number }
  | { kind: "unknown"; daysGiven: number };

/** Live shortfall: `max(0, notice_period_days - days(requested_lwd - notice_date))`. */
export function shortfallPreview(
  noticeDate: string | null | undefined,
  requestedLwd: string | null | undefined,
  noticePeriodDays: number | null | undefined,
): ShortfallPreview | null {
  const given = daysBetween(noticeDate, requestedLwd);
  if (given === null) return null;
  if (given < 0) return { kind: "invalid", message: "The last working day must be on or after the notice date." };
  if (noticePeriodDays === null || noticePeriodDays === undefined) return { kind: "unknown", daysGiven: given };
  return { kind: "known", daysGiven: given, noticePeriod: noticePeriodDays, shortfall: Math.max(0, noticePeriodDays - given) };
}

export function shortfallText(p: ShortfallPreview | null): string {
  if (!p) return "Enter the notice date and requested last working day.";
  if (p.kind === "invalid") return p.message;
  const given = `${p.daysGiven} ${p.daysGiven === 1 ? "day" : "days"} of notice given`;
  if (p.kind === "unknown") return `${given}. The contractual notice period is not recorded.`;
  if (p.shortfall === 0) return `${given}; the ${p.noticePeriod}-day notice period is met.`;
  return `${given} of ${p.noticePeriod} required: shortfall of ${p.shortfall} ${p.shortfall === 1 ? "day" : "days"}.`;
}

// ---------------------------------------------------------------- extension wizard gating
export function blockingChecks(checks: CheckResult[]): CheckResult[] {
  return checks.filter((c) => c.status === "fail" && !c.overridable);
}

export function overridableFails(checks: CheckResult[]): CheckResult[] {
  return checks.filter((c) => c.status === "fail" && c.overridable);
}

export type WizardForm = { currentEndDate: string; newEndDate: string; payRate: string; billRate: string; vendorRate: string };

const DECIMAL = /^\d+(\.\d{1,4})?$/;

export function isDecimalOrEmpty(v: string): boolean {
  return v.trim() === "" || DECIMAL.test(v.trim());
}

/** Why the Propose button is disabled (null = enabled). A non-overridable fail always blocks. */
export function wizardBlockReason(form: WizardForm, preview: ExtensionPreviewOut | null | undefined, previewPending: boolean): string | null {
  if (!form.newEndDate) return "Pick the new end date.";
  const d = daysBetween(form.currentEndDate, form.newEndDate);
  if (d !== null && d <= 0) return "The new end date must be after the current end date.";
  if (![form.payRate, form.billRate, form.vendorRate].every(isDecimalOrEmpty)) return "Rates must be positive numbers.";
  if (previewPending || !preview) return "Running checks…";
  const blocking = blockingChecks(preview.checks);
  if (blocking.length > 0) return `Blocked by: ${blocking.map((c) => humanize(c.name)).join(", ")}.`;
  return null;
}

export function marginText(preview: ExtensionPreviewOut | null | undefined, ratesEntered: boolean): string {
  if (!ratesEntered) return "Rates unchanged";
  if (!preview) return "—";
  if (preview.margin_amount === null && preview.margin_pct === null) return "Masked";
  const pct = preview.margin_pct !== null && Number.isFinite(Number(preview.margin_pct)) ? `${Number(preview.margin_pct).toFixed(2)} %` : "—";
  return `${preview.margin_amount ?? "—"} (${pct})`;
}

// ---------------------------------------------------------------- extension tracker
export const TRACKER_STEPS = ["Proposed", "Approval", "Client", "Confirmed"] as const;

/** Index of the current tracker step (0..3); terminal negatives map to -1. */
export function trackerStep(status: ExtensionStatus): number {
  switch (status) {
    case "proposed":
      return 0;
    case "pending_approval":
      return 1;
    case "pending_client_confirmation":
      return 2;
    case "confirmed":
      return 3;
    default:
      return -1;
  }
}

export function isOpenExtension(status: ExtensionStatus): boolean {
  return status === "proposed" || status === "pending_approval" || status === "pending_client_confirmation";
}

/** ★ Confirm is offered while the extension waits for the client (portal / link / recorded response). */
export function canConfirmExtension(status: ExtensionStatus): boolean {
  return status === "pending_client_confirmation";
}

// ---------------------------------------------------------------- offboarding checklist
export function canCloseCase(status: CaseStatus): boolean {
  return status === "ready_to_close";
}

export function canCancelCase(status: CaseStatus, lastWorkingDay: string, today: string = todayIso()): boolean {
  if (status !== "initiated" && status !== "in_progress") return false;
  const d = daysBetween(today, lastWorkingDay);
  return d !== null && d > 0;
}

export function isCaseOpen(status: CaseStatus): boolean {
  return status === "initiated" || status === "in_progress" || status === "ready_to_close";
}

export type OwnerGroup = { role: string; label: string; items: OffboardingItemOut[] };

/** Items grouped by owner role (template order kept within and across groups). */
export function groupByOwner(items: OffboardingItemOut[]): OwnerGroup[] {
  const groups = new Map<string, OwnerGroup>();
  for (const item of [...items].sort((a, b) => a.position - b.position)) {
    const role = item.owner_role ?? "unassigned";
    if (!groups.has(role)) groups.set(role, { role, label: ownerLabel(item.owner_role), items: [] });
    groups.get(role)!.items.push(item);
  }
  return [...groups.values()];
}

export function pendingMandatory(items: OffboardingItemOut[]): OffboardingItemOut[] {
  return items.filter((i) => i.mandatory && i.status === "pending");
}

/** Deep link for an item handled in another module (placement filter prefilled). */
export function itemLink(kind: string, placementId: string): { href: string; label: string } | null {
  const q = `?placement_id=${encodeURIComponent(placementId)}`;
  switch (kind) {
    case "final_timesheet_approved":
      return { href: `/timesheets${q}`, label: "Timesheets" };
    case "final_expense_settlement":
      return { href: `/expenses${q}`, label: "Expenses" };
    case "final_payroll_inclusion":
      return { href: `/payroll${q}`, label: "Payroll" };
    case "final_invoice":
      return { href: `/billing/runs${q}`, label: "Invoice runs" };
    default:
      return null;
  }
}

export function isDocumentItem(kind: string): boolean {
  return kind === "relieving_letter" || kind === "experience_letter";
}

// ---------------------------------------------------------------- portal / secure link responses
export type ResponseState = "awaiting" | "confirmed" | "declined" | "closed";

/** Client-side state of an extension card / link. */
export function extensionResponseState(status: string): ResponseState {
  if (status === "pending_client_confirmation") return "awaiting";
  if (status === "confirmed") return "confirmed";
  if (status === "declined") return "declined";
  return "closed";
}

export function offboardingResponseState(status: string, clientConfirmed: boolean): ResponseState {
  if (clientConfirmed) return "confirmed";
  if (status === "closed" || status === "cancelled") return "closed";
  return "awaiting";
}

export const RESPONSE_COPY: Record<ResponseState, string> = {
  awaiting: "Awaiting your response",
  confirmed: "Confirmed",
  declined: "Declined",
  closed: "No longer open",
};

// ---------------------------------------------------------------- errors
const EXIT_ERROR_COPY: Record<string, string> = {
  extension_exists: "An extension is already open for this placement.",
  offboarding_in_progress: "An offboarding case is open for this placement.",
  extension_blocked: "A blocking check failed. Resolve it or request an exception.",
  checks_changed: "Checks changed since you last looked. Review them and try again.",
  extension_not_pending: "This extension is no longer waiting for a response.",
  items_incomplete: "Some mandatory checklist items are not complete.",
  past_last_working_day: "The case cannot be cancelled after the last working day.",
  conversion_exists: "A conversion is already recorded for this placement.",
};

export function exitErrorMessage(e: unknown, fallback = "Something went wrong. Please try again."): string {
  if (isApiError(e)) {
    if (EXIT_ERROR_COPY[e.code]) return EXIT_ERROR_COPY[e.code];
    if (e.status === 0) return "Cannot reach the server. Check your connection and try again.";
    if (e.status >= 500) return fallback;
    return e.message || fallback;
  }
  return fallback;
}

// ---------------------------------------------------------------- templates
const KIND_RE = /^[a-z][a-z0-9_]{1,59}$/;

/** First validation problem of a checklist template (null = valid). */
export function templateErrors(name: string, items: TemplateItem[]): string | null {
  if (!name.trim()) return "Name the template.";
  if (items.length === 0) return "Add at least one item.";
  const kinds = new Set<string>();
  for (const i of items) {
    if (!KIND_RE.test(i.kind)) return `Kind "${i.kind}" must be lower_snake_case.`;
    if (kinds.has(i.kind)) return `Kind "${i.kind}" is repeated.`;
    kinds.add(i.kind);
    if (!i.label.trim()) return "Every item needs a label.";
    if (!Number.isInteger(i.due_offset_days) || i.due_offset_days < -90 || i.due_offset_days > 90) return "Due offsets must be between -90 and 90 days.";
  }
  return null;
}
