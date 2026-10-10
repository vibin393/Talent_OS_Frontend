/** Pure view logic for the ecosystem console (Epic 79, spec B2/B3). Kept framework-free so it can be unit-tested. */
import type { AccessReview, AccessReviewItem, ConsoleSummary, InstallationRow } from "./api";

// ---------------------------------------------------------------- console tabs
export type ConsoleTabKey =
  | "installations"
  | "authorizations"
  | "webhooks"
  | "mcp"
  | "data-flows"
  | "policy-events"
  | "test-results";

export const CONSOLE_TABS: readonly { key: ConsoleTabKey; label: string }[] = [
  { key: "installations", label: "Installations" },
  { key: "authorizations", label: "Authorisations" },
  { key: "webhooks", label: "Webhooks" },
  { key: "mcp", label: "MCP" },
  { key: "data-flows", label: "Data flows" },
  { key: "policy-events", label: "Policy events" },
  { key: "test-results", label: "Test results" },
];

export function isConsoleTab(value: string | null | undefined): value is ConsoleTabKey {
  return !!value && CONSOLE_TABS.some((t) => t.key === value);
}

export function activeConsoleTab(value: string | null | undefined): ConsoleTabKey {
  return isConsoleTab(value) ? value : "installations";
}

// ---------------------------------------------------------------- installation type / status labels
export const INSTALLATION_TYPE_LABELS: Record<string, string> = {
  app: "App",
  connector: "Connector",
  api_key: "API key",
};

export function installationTypeLabel(kind: string): string {
  return INSTALLATION_TYPE_LABELS[kind] ?? kind;
}

export const PUBLISHER_LABELS: Record<string, string> = {
  platform: "Talent OS",
  partner: "Partner",
  tenant: "Your organisation",
};

export function publisherLabel(publisher: string | null | undefined): string {
  if (!publisher) return "—";
  return PUBLISHER_LABELS[publisher] ?? publisher;
}

export type BadgeColor = "success" | "warning" | "danger" | "informative" | "subtle" | "brand";

/** Status → badge colour. Healthy/active is green; degraded is amber; suspended/revoked is red. */
export function statusColor(status: string | null | undefined): BadgeColor {
  switch ((status ?? "").toLowerCase()) {
    case "active":
    case "healthy":
    case "ok":
    case "live":
      return "success";
    case "degraded":
    case "warning":
    case "pending":
    case "expiring":
      return "warning";
    case "suspended":
    case "revoked":
    case "failed":
    case "error":
      return "danger";
    default:
      return "subtle";
  }
}

/** Whether a scope is sensitive, for the warning-coloured chips. */
export function isSensitiveScope(scope: string, sensitive: readonly string[]): boolean {
  return sensitive.includes(scope);
}

// ---------------------------------------------------------------- data-flow direction / purpose
export function directionLabel(direction: string): string {
  if (direction === "out") return "Sent to";
  if (direction === "in") return "Received from";
  return direction;
}

export const RESTRICTED_TRANSFER_BADGE = "Restricted transfer";

// ---------------------------------------------------------------- policy events (violations)
export const VIOLATION_LABELS: Record<string, string> = {
  egress_refused: "Blocked address",
  scope_refused: "Missing access",
  injection_detected: "Suspicious input",
  refresh_reuse: "Reused token",
  human_only_refused: "Human-only action refused",
  bulk_extraction_paused: "Bulk extraction paused",
};

export function violationLabel(kind: string): string {
  return VIOLATION_LABELS[kind] ?? kind;
}

export const VIOLATION_FILTERS: readonly { value: string; label: string }[] = [
  { value: "", label: "All types" },
  ...Object.entries(VIOLATION_LABELS).map(([value, label]) => ({ value, label })),
];

// ---------------------------------------------------------------- summary header cards
export type SummaryCard = { key: string; label: string; value: number; color: BadgeColor };

/** The six header cards in spec order; "Needs attention" sums degraded + suspended. */
export function summaryCards(s: ConsoleSummary | undefined): SummaryCard[] {
  const v = (n: number | undefined) => n ?? 0;
  const needsAttention = v(s?.degraded) + v(s?.suspended);
  return [
    { key: "active", label: "Active", value: v(s?.active), color: "success" },
    { key: "attention", label: "Needs attention", value: needsAttention, color: needsAttention ? "warning" : "subtle" },
    { key: "reconsent", label: "Re-consent needed", value: v(s?.pending_reconsents), color: s?.pending_reconsents ? "warning" : "subtle" },
    { key: "webhooks", label: "Failing webhooks", value: v(s?.failing_subscriptions), color: s?.failing_subscriptions ? "danger" : "subtle" },
    { key: "mcp", label: "MCP sessions now", value: v(s?.active_mcp_sessions), color: "informative" },
    { key: "policy", label: "Policy events (7 days)", value: v(s?.violations_7d), color: s?.violations_7d ? "warning" : "subtle" },
  ];
}

export const KILL_SWITCH_BANNER = "External access is paused. Apps, webhooks, MCP and connector jobs are stopped.";

// ---------------------------------------------------------------- view-only notice
export const VIEW_ONLY_NOTICE = "You can view integrations. Ask an Integration Administrator to make changes.";

// ---------------------------------------------------------------- revoke reason
export function revokeReasonError(reason: string): string | null {
  return reason.trim().length === 0 ? "Enter a reason." : null;
}
export const REVOKE_REASON_PROMPT = "Why are you revoking this access?";

// ---------------------------------------------------------------- access-review item kind labels / decisions
export const REVIEW_ITEM_KIND_LABELS: Record<string, string> = {
  installation_grant: "App / connector",
  user_authorization: "User authorisation",
  api_key: "API key",
};

export function reviewItemKindLabel(kind: string): string {
  return REVIEW_ITEM_KIND_LABELS[kind] ?? kind;
}

export const REVIEW_ITEM_KIND_FILTERS: readonly { value: string; label: string }[] = [
  { value: "", label: "All types" },
  ...Object.entries(REVIEW_ITEM_KIND_LABELS).map(([value, label]) => ({ value, label })),
];

export const DECISION_LABELS: Record<string, string> = {
  pending: "Not reviewed",
  confirmed: "Kept",
  reduced: "Reduced",
  revoked: "Revoked",
  auto_revoked: "Auto-revoked",
};

export function decisionLabel(decision: string): string {
  return DECISION_LABELS[decision] ?? decision;
}

export function decisionColor(decision: string): BadgeColor {
  switch (decision) {
    case "confirmed":
      return "success";
    case "reduced":
      return "warning";
    case "revoked":
    case "auto_revoked":
      return "danger";
    default:
      return "subtle";
  }
}

/** "Not used for {n} days" badge text when the item is stale; the snapshot may carry `days_since_use`. */
export function staleBadge(item: Pick<AccessReviewItem, "stale" | "snapshot">): string | null {
  if (!item.stale) return null;
  const n = item.snapshot?.days_since_use;
  return typeof n === "number" ? `Not used for ${n} days` : "Not used recently";
}

export const AUTO_REVOKE_WARNING = "People will be notified before access is removed.";

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  completed: "Completed",
  expired: "Expired",
};

export function reviewStatusLabel(status: string): string {
  return REVIEW_STATUS_LABELS[status] ?? status;
}

export function reviewStatusColor(status: string): BadgeColor {
  if (status === "completed") return "success";
  if (status === "expired") return "danger";
  return "brand";
}

/** A review is complete-able when it is open and every item has a decision. */
export function canCompleteReview(review: Pick<AccessReview, "status">, items: readonly AccessReviewItem[]): boolean {
  return review.status === "open" && items.length > 0 && items.every((i) => i.decision !== "pending");
}

// ---------------------------------------------------------------- feature readiness
export const READINESS_STATUS_LABELS: Record<string, string> = {
  ok: "Ready",
  warning: "Needs attention",
  blocking: "Not ready",
};

export function readinessLabel(status: string): string {
  return READINESS_STATUS_LABELS[status] ?? status;
}

export function readinessColor(status: string): BadgeColor {
  if (status === "ok") return "success";
  if (status === "blocking") return "danger";
  return "warning";
}

// ---------------------------------------------------------------- installations client-side filter helper
export function filterInstallations(rows: readonly InstallationRow[], kind: string | null, q: string | null): InstallationRow[] {
  const needle = (q ?? "").trim().toLowerCase();
  return rows.filter((r) => {
    if (kind && r.kind !== kind) return false;
    if (needle && !r.name.toLowerCase().includes(needle)) return false;
    return true;
  });
}
