/** Pure helpers for the privacy center (Epic 12: DSRs, erasure, retention, support access). */
import type {
  DsrChannel,
  DsrKind,
  DsrOut,
  DsrStatus,
  ErasureRunOut,
  SupportGrantStatus,
} from "@/lib/api/types";

export type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";

export const DSR_KIND_LABELS: Record<DsrKind, string> = {
  access: "Access",
  correction: "Correction",
  erasure: "Erasure",
  consent_withdrawal: "Consent withdrawal",
};

export const DSR_STATUS_LABELS: Record<DsrStatus, string> = {
  received: "Received",
  in_progress: "In progress",
  completed: "Completed",
  refused: "Refused",
};

export const DSR_STATUS_COLORS: Record<DsrStatus, BadgeColor> = {
  received: "informative",
  in_progress: "brand",
  completed: "success",
  refused: "subtle",
};

export const DSR_CHANNEL_LABELS: Record<DsrChannel, string> = {
  candidate_portal: "Candidate portal",
  email: "Email",
  phone: "Phone",
  letter: "Letter",
  other: "Other",
};

export const CONSENT_PURPOSE_LABELS: Record<string, string> = {
  data_processing: "Data processing",
  ai_processing: "AI processing",
  client_submission: "Client submission",
  marketing: "Marketing",
  // Epic 35 purposes.
  bgv: "Background verification",
  reference_check: "Reference checks",
  vendor_collection: "Collection by a vendor",
  whatsapp: "WhatsApp messages",
  engagement: "Engagement",
};

/** Epic 35: every consent purpose a notice can be written for, in display order. */
export const ALL_CONSENT_PURPOSES = [
  "ai_processing",
  "data_processing",
  "client_submission",
  "marketing",
  "bgv",
  "reference_check",
  "vendor_collection",
  "whatsapp",
  "engagement",
] as const;

/**
 * Purposes shown for information only: `engagement` is required while the worker is on assignment and can
 * never be withdrawn from the UI (the server refuses with 409 `engagement_active`).
 */
export const READ_ONLY_CONSENT_PURPOSES: readonly string[] = ["engagement"];
export const ENGAGEMENT_NOTE = "Required while you are on assignment";

export function isWithdrawableConsent(purpose: string): boolean {
  return !READ_ONLY_CONSENT_PURPOSES.includes(purpose);
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const DUE_SOON_DAYS = 7;

export function isDsrClosed(status: DsrStatus): boolean {
  return status === "completed" || status === "refused";
}

/** Overdue: past `due_at` and still open (the server's `overdue` flag is trusted when present). */
export function isDsrOverdue(dsr: Pick<DsrOut, "status" | "due_at"> & { overdue?: boolean }, now: Date = new Date()): boolean {
  if (isDsrClosed(dsr.status)) return false;
  if (dsr.overdue) return true;
  const due = Date.parse(dsr.due_at);
  return Number.isFinite(due) && now.getTime() > due;
}

/** The due-date badge: red "Overdue", amber "Due in N days" within 7 days, otherwise none. */
export function dsrDueBadge(
  dsr: Pick<DsrOut, "status" | "due_at"> & { overdue?: boolean },
  now: Date = new Date(),
): { label: string; color: BadgeColor } | null {
  if (isDsrClosed(dsr.status)) return null;
  if (isDsrOverdue(dsr, now)) return { label: "Overdue", color: "danger" };
  const due = Date.parse(dsr.due_at);
  if (!Number.isFinite(due)) return null;
  const days = Math.ceil((due - now.getTime()) / DAY_MS);
  if (days <= DUE_SOON_DAYS) return { label: days <= 1 ? "Due today" : `Due in ${days} days`, color: "warning" };
  return null;
}

/** Status steps shown on the DSR detail page (refused replaces the final step). */
export function dsrSteps(status: DsrStatus): { key: string; label: string; state: "done" | "current" | "todo" | "refused" }[] {
  const order: DsrStatus[] = ["received", "in_progress", "completed"];
  if (status === "refused") {
    return [
      { key: "received", label: "Received", state: "done" },
      { key: "refused", label: "Refused", state: "refused" },
    ];
  }
  const at = order.indexOf(status);
  return order.map((s, i) => ({
    key: s,
    label: DSR_STATUS_LABELS[s],
    state: i < at || (s === "completed" && status === "completed") ? "done" : i === at ? "current" : "todo",
  }));
}

/** The typed confirmation required before erasing a candidate. */
export const ERASURE_CONFIRM_WORD = "ERASE";
/** The typed confirmation required before executing a retention run. */
export const RETENTION_CONFIRM_WORD = "ANONYMIZE";

/** Whether the typed text confirms (exact word, surrounding spaces ignored, case-sensitive). */
export function isConfirmed(typed: string, word: string): boolean {
  return typed.trim() === word;
}

/** Minimum refusal reason length (DSR_TRANSITIONS). */
export const MIN_REFUSAL_REASON = 10;

export type HandlerProgress = { name: string; status: "ok" | "failed" | "pending"; detail: string };

/** Per-handler progress of an erasure run, in the order the backend reported them. */
export function erasureProgress(run: Pick<ErasureRunOut, "handler_results"> | null | undefined): HandlerProgress[] {
  const results = (run?.handler_results ?? {}) as Record<string, unknown>;
  return Object.entries(results).map(([name, raw]) => {
    const r = (raw && typeof raw === "object" ? raw : {}) as { status?: string; counts?: Record<string, number>; error?: string };
    const status = r.status === "ok" ? "ok" : r.status === "failed" ? "failed" : "pending";
    const detail =
      status === "failed"
        ? `Failed${r.error ? ` (${r.error})` : ""}`
        : r.counts
          ? Object.entries(r.counts)
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ") || "Nothing to erase"
          : "";
    return { name, status, detail };
  });
}

/** Whether an erasure run is still working (the detail page polls every 3 s while true). */
export function isErasureActive(run: Pick<ErasureRunOut, "status"> | null | undefined): boolean {
  return !!run && (run.status === "pending" || run.status === "running");
}

export const SUPPORT_STATUS_COLORS: Record<SupportGrantStatus, BadgeColor> = {
  pending: "warning",
  approved: "success",
  denied: "subtle",
  revoked: "danger",
  expired: "subtle",
  cancelled: "subtle",
};

/** "hh:mm" (or "d day(s) hh:mm") until `until`; "00:00" once passed. */
export function formatCountdown(until: string | Date | null | undefined, now: Date = new Date()): string {
  if (!until) return "—";
  const end = typeof until === "string" ? Date.parse(until) : until.getTime();
  if (!Number.isFinite(end)) return "—";
  const totalMinutes = Math.max(0, Math.floor((end - now.getTime()) / 60000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const hhmm = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return days > 0 ? `${days} day${days === 1 ? "" : "s"} ${hhmm}` : hhmm;
}

export const RETENTION_ITEM_LABELS: Record<string, string> = {
  pending: "Pending",
  erased: "Anonymized",
  skipped_now_active: "Skipped (active again)",
  failed: "Failed",
};

export const RETENTION_RUN_COLORS: Record<string, BadgeColor> = {
  previewed: "informative",
  executing: "brand",
  completed: "success",
  cancelled: "subtle",
  expired: "subtle",
};

/** A human title for a snake_case value ("in_progress" -> "In progress"). */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  const s = value.replace(/[_.]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
