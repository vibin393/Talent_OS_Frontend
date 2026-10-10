/**
 * HRMS sync pure logic and labels (Epic 71): status/transform/push-kind labels, badge colours, the sensitive-field
 * catalogue and whether the sensitive switch is enabled for a given user. Imported by the UI and the vitest suite.
 */
import type { HrmsRecordStatus, Transform } from "./api";

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  blocked: "Blocked",
  synced: "Synced",
  failed: "Failed",
  skipped: "Skipped",
};

export type BadgeColor = "success" | "warning" | "danger" | "informative" | "subtle";

export const STATUS_COLOR: Record<string, BadgeColor> = {
  pending: "informative",
  blocked: "warning",
  synced: "success",
  failed: "danger",
  skipped: "subtle",
};

export function statusBadge(status: string): { label: string; color: BadgeColor } {
  return { label: STATUS_LABELS[status] ?? status, color: STATUS_COLOR[status] ?? "informative" };
}

export const PUSH_KIND_LABELS: Record<string, string> = { hire: "Hire", change: "Change", exit: "Exit" };

export const HRMS_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  exited: "Exited",
  pending: "Pending",
  unknown: "Unknown",
};

export const TRANSFORM_OPTIONS: { value: Transform; label: string }[] = [
  { value: "none", label: "None" },
  { value: "date_iso", label: "Date (YYYY-MM-DD)" },
  { value: "date_dmy", label: "Date (DD-MM-YYYY)" },
  { value: "upper", label: "Upper case" },
  { value: "lower", label: "Lower case" },
  { value: "lookup", label: "Lookup" },
];

export function transformLabel(value: string): string {
  return TRANSFORM_OPTIONS.find((o) => o.value === value)?.label ?? "None";
}

/** The catalogue key used for a fixed value (no local field). The UI shows it as "Fixed value". */
export const FIXED_VALUE = "__fixed__";

/**
 * The sensitive switch is disabled unless the user holds `ledger:sync` (Finance). Only Finance can turn these on,
 * with a recorded purpose (spec Boundaries & A3). Mirrors the backend 403 `sensitive_mapping_requires_finance`.
 */
export function canToggleSensitive(hasLedgerSync: boolean): boolean {
  return hasLedgerSync;
}

export const QUEUE_TABS: { key: string; label: string }[] = [
  { key: "pending", label: "Waiting" },
  { key: "blocked", label: "Blocked" },
  { key: "failed", label: "Failed" },
  { key: "synced", label: "Synced" },
  { key: "mismatch", label: "Mismatches" },
];

/** The record `status` filter for a queue tab ("mismatch" filters by the mismatch flag instead). */
export function tabFilter(tab: string): { status?: HrmsRecordStatus; mismatch?: boolean } {
  if (tab === "mismatch") return { mismatch: true };
  return { status: tab as HrmsRecordStatus };
}
