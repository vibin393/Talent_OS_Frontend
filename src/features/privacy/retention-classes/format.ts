/** Pure helpers for retention classes (Epic 35 B1). */
import type {
  ClassExpiryPreview,
  DsrSubjectKind,
  ExpiryAction,
  RetainedSummaryRow,
  RetentionAnchor,
  RetentionBinding,
  RetentionClass,
} from "./types";

export const ANCHOR_LABELS: Record<RetentionAnchor, string> = {
  document_date: "Document date",
  fy_end: "End of financial year",
  adjudicated_at: "Adjudication date",
  signed_at: "Signing date",
  placement_end: "Placement end",
  period_end: "Period end",
};

export const EXPIRY_ACTION_LABELS: Record<ExpiryAction, string> = {
  anonymize: "Anonymize",
  delete: "Delete",
  report_only: "Report only",
};

/** The typed confirmation required before executing a class expiry run. */
export const EXPIRY_CONFIRM_WORD = "EXPIRE";

export const MAX_PERIOD_MONTHS = 1200;

/** "96 months (8 years)" / "18 months". */
export function formatPeriod(months: number): string {
  if (months % 12 === 0 && months >= 12) {
    const y = months / 12;
    return `${months} months (${y} year${y === 1 ? "" : "s"})`;
  }
  return `${months} month${months === 1 ? "" : "s"}`;
}

/** The smallest allowed period: the statutory floor, or 1 month. */
export function minPeriod(c: Pick<RetentionClass, "floor_months">): number {
  return Math.max(1, c.floor_months ?? 1);
}

/** Validation message for a period, or null when it is allowed (mirrors the 422 `below_statutory_floor`). */
export function periodError(months: number | null | undefined, floor: number | null | undefined): string | null {
  if (months === null || months === undefined || !Number.isFinite(months) || !Number.isInteger(months)) return "Enter a whole number of months.";
  if (months < 1) return "Enter at least 1 month.";
  if (months > MAX_PERIOD_MONTHS) return `Enter at most ${MAX_PERIOD_MONTHS} months.`;
  if (floor && months < floor) return `The statutory minimum for this class is ${floor} months.`;
  return null;
}

/**
 * Financial records are never expired until the immutability exception is ratified: the class is
 * report-only and its row is shown disabled with this explanation.
 */
export function isReportOnlyClass(c: Pick<RetentionClass, "key" | "expiry_action">): boolean {
  return c.expiry_action === "report_only" || c.key === "financial";
}

export const REPORT_ONLY_EXPLANATION =
  "Financial records are reported but never expired until the immutability exception is ratified.";

/** Badge for a binding: "Registered", or "Pending (Epic N)" while its owning epic is unmerged. */
export function bindingBadge(b: Pick<RetentionBinding, "status" | "owner_epic">): { label: string; color: "success" | "warning" } {
  if (b.status === "registered") return { label: "Registered", color: "success" };
  const raw = b.owner_epic?.trim();
  if (!raw) return { label: "Pending", color: "warning" };
  const n = /^(?:epic[\s_-]*)?(\d+)$/i.exec(raw);
  return { label: `Pending (${n ? `Epic ${n[1]}` : raw})`, color: "warning" };
}

/**
 * Whether the expiry run may be executed: a real run (not report-only) with rows to expire, and the
 * exact word EXPIRE typed.
 */
export function canExecuteExpiry(preview: ClassExpiryPreview | null | undefined, typed: string): boolean {
  if (!preview || preview.report_only || !preview.run_id || preview.total <= 0) return false;
  return typed.trim() === EXPIRY_CONFIRM_WORD;
}

/** Whether the Execute button itself is offered for a preview. */
export function canStartExpiry(preview: ClassExpiryPreview | null | undefined): boolean {
  return !!preview && !preview.report_only && !!preview.run_id && preview.total > 0;
}

/** Active (not archived) classes, system classes first, then by label. */
export function activeClasses(classes: readonly RetentionClass[]): RetentionClass[] {
  return classes
    .filter((c) => !c.archived_at)
    .sort((a, b) => Number(b.is_system) - Number(a.is_system) || a.label.localeCompare(b.label));
}

/** Class keys are lower snake case, 2–40 characters. */
export function classKeyError(key: string): string | null {
  return /^[a-z][a-z0-9_]{1,39}$/.test(key.trim()) ? null : "Use 2–40 lowercase letters, digits or underscores, starting with a letter.";
}

export const DSR_SUBJECT_KIND_LABELS: Record<DsrSubjectKind, string> = {
  candidate: "Candidate",
  contact: "Contact",
  client_user: "Client User",
  vendor_user: "Vendor User",
};

/** "Retained: financial (until 31-Mar-2035), bgv_evidence (until …)" from a retained summary. */
export function retainedSentence(rows: readonly RetainedSummaryRow[], formatDate: (iso: string) => string): string {
  if (rows.length === 0) return "Nothing was retained.";
  const byClass = new Map<string, string | null>();
  for (const r of rows) {
    const prev = byClass.get(r.class);
    if (!byClass.has(r.class) || (r.retained_until && (!prev || r.retained_until > prev))) byClass.set(r.class, r.retained_until);
  }
  return `Retained: ${[...byClass.entries()].map(([c, until]) => (until ? `${c} (until ${formatDate(until)})` : c)).join(", ")}`;
}
