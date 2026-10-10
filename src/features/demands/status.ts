/**
 * Pure demand status helpers: labels and badge colours for the snake_case API enums, the §5.1
 * transition table as seen by a human user (button visibility only; the API enforces it again) and
 * SLA badges.
 */
import { hasPermission, type PermissionMap } from "@/features/auth/permissions";
import type { DemandPriority, DemandProgress, DemandStatus, SlaMilestone, SlaStatus } from "@/lib/api/types";

export type BadgeColor = "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";

export const DEMAND_STATUSES: readonly DemandStatus[] = [
  "draft",
  "pending_approval",
  "open",
  "on_hold",
  "filled",
  "cancelled",
  "closed",
];

export const STATUS_LABELS: Record<DemandStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  open: "Open",
  on_hold: "On hold",
  filled: "Filled",
  cancelled: "Cancelled",
  closed: "Closed",
};

export const STATUS_COLORS: Record<DemandStatus, BadgeColor> = {
  draft: "subtle",
  pending_approval: "warning",
  open: "brand",
  on_hold: "severe",
  filled: "success",
  cancelled: "danger",
  closed: "informative",
};

export const PROGRESS_LABELS: Record<DemandProgress, string> = {
  recruiting: "Recruiting",
  submitted: "Submitted",
  interviewing: "Interviewing",
  offer: "Offer",
  partially_filled: "Partially filled",
};

/** Progress label, or an em dash when the demand has no derived progress yet. */
export function progressLabel(progress: DemandProgress | null | undefined): string {
  return progress ? PROGRESS_LABELS[progress] : "—";
}

export const PRIORITIES: readonly DemandPriority[] = ["low", "medium", "high", "critical"];

export const PRIORITY_LABELS: Record<DemandPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const PRIORITY_COLORS: Record<DemandPriority, BadgeColor> = {
  low: "subtle",
  medium: "informative",
  high: "warning",
  critical: "danger",
};

export const SLA_LABELS: Record<SlaStatus, string> = {
  healthy: "Healthy",
  at_risk: "At risk",
  breached: "Breached",
  met: "Met",
};

export const MILESTONE_LABELS: Record<SlaMilestone, string> = {
  assignment: "Recruiter assigned",
  first_submission: "First submission",
  first_interview: "First interview",
  client_feedback: "Client feedback",
};

/** Badge for an SLA status (`null` when there is no clock). */
export function slaBadge(status: SlaStatus | null | undefined): { label: string; color: BadgeColor } | null {
  if (!status) return null;
  const color: Record<SlaStatus, BadgeColor> = {
    healthy: "success",
    at_risk: "warning",
    breached: "danger",
    met: "informative",
  };
  return { label: SLA_LABELS[status], color: color[status] };
}

export type DemandAction =
  | "edit"
  | "submit"
  | "hold"
  | "resume"
  | "cancel"
  | "close"
  | "reopen"
  | "publish"
  | "assign"
  | "archive";

/** Target status of each transition action (Submit goes through the approval chain instead). */
export const ACTION_TARGET: Partial<Record<DemandAction, DemandStatus>> = {
  hold: "on_hold",
  resume: "open",
  cancel: "cancelled",
  close: "closed",
  reopen: "open",
};

/** Actions that need a reason code (and take an optional comment). */
export const REASON_ACTIONS: readonly DemandAction[] = ["hold", "cancel", "close"];

/** User-initiated actions per status, mirroring PRD §5.1 (system/approval-only moves excluded). */
const BY_STATUS: Record<DemandStatus, readonly DemandAction[]> = {
  draft: ["edit", "submit", "cancel", "archive"],
  pending_approval: ["edit"],
  open: ["edit", "hold", "cancel", "close", "publish", "assign"],
  on_hold: ["edit", "resume", "cancel", "close", "assign"],
  filled: ["edit", "reopen", "close"],
  cancelled: ["archive"],
  closed: ["archive"],
};

const PERMISSION: Record<DemandAction, string> = {
  edit: "demand:update",
  submit: "demand:update",
  hold: "demand:update",
  resume: "demand:update",
  cancel: "demand:update",
  close: "demand:update",
  reopen: "demand:update",
  publish: "demand:update",
  assign: "demand:assign",
  archive: "demand:delete",
};

/** Actions to offer for a demand in `status` to a user holding `permissions`. */
export function allowedActions(
  status: DemandStatus,
  permissions: PermissionMap,
  opts: { archived?: boolean } = {},
): DemandAction[] {
  if (opts.archived) return [];
  return BY_STATUS[status].filter((a) => hasPermission(permissions, PERMISSION[a]));
}

/** Human label for a snake_case reason code (`budget_pending` -> "Budget pending"). */
export function reasonLabel(code: string | null | undefined): string {
  if (!code) return "";
  const text = code.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
