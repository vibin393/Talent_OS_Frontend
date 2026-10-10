/**
 * Pure view models for the Phase 5 "Ecosystem" and "Platform outcomes" dashboards (Epic 79 story 79.3, FR-407,
 * spec B4 / §A5). Tile titles are the spec's exact labels.
 *
 * GAP: the reporting `dashboards_p5` projections exist but are not registered into the `/api/v1/dashboards` tile
 * engine, and no router serves per-tile P5 data. Tiles that can be derived from console reads
 * (`/ecosystem-console/*`) are populated here; the rest render the empty state and note the missing endpoint.
 */
import type { InstallationRow } from "@/features/ecosystem-console/api";

export type P5DashboardKey = "ecosystem" | "platform_outcomes";

export type P5TileDef = {
  key: string;
  title: string;
  /** Per-tile permission (spec §A5); the tab also gates by its own permission. */
  permission: string;
  /** Tiles the console can populate today; the rest show the empty state. */
  derivable?: boolean;
};

export const P5_TAB_LABELS: Record<P5DashboardKey, string> = {
  ecosystem: "Ecosystem",
  platform_outcomes: "Platform outcomes",
};

/** Permission to see each tab (spec §A5): Ecosystem = integration:view; Platform outcomes = report:read. */
export const P5_TAB_PERMISSION: Record<P5DashboardKey, string> = {
  ecosystem: "integration:view",
  platform_outcomes: "report:read",
};

export const ECOSYSTEM_TILES: readonly P5TileDef[] = [
  { key: "api_requests", title: "API requests & error rate", permission: "usage:read", derivable: true },
  { key: "webhook_health", title: "Webhook success & latency", permission: "integration:view" },
  { key: "connector_health", title: "Connector health by category", permission: "integration:view" },
  { key: "job_board_performance", title: "Job-board performance", permission: "integration:view" },
  { key: "sync_status", title: "HRMS & ledger sync status", permission: "integration:view" },
  { key: "calendar_health", title: "Calendar sync health", permission: "integration:view" },
  { key: "mcp_usage", title: "MCP usage & Proposal acceptance", permission: "integration:view" },
  { key: "job_network", title: "Job Network performance", permission: "integration:view" },
  { key: "telephony", title: "Telephony & STT minutes", permission: "integration:view" },
  { key: "portal_copilot", title: "Portal Copilot usage", permission: "integration:view" },
  { key: "campaign_copy", title: "Campaign copy approvals", permission: "integration:view" },
];

export const PLATFORM_OUTCOME_TILES: readonly P5TileDef[] = [
  { key: "adoption", title: "Integration adoption (SM-40)", permission: "report:read" },
  { key: "webhook_reliability", title: "Webhook reliability (SM-42)", permission: "report:read" },
  { key: "install_success", title: "Install success (SM-44)", permission: "report:read" },
  { key: "job_board_reach", title: "Job-board reach (SM-45)", permission: "report:read" },
  { key: "back_office_sync", title: "Back-office sync (SM-46)", permission: "report:read" },
  { key: "calendar_turnaround", title: "Calendar turnaround (SM-47)", permission: "report:read" },
  { key: "mcp_safety", title: "MCP use & safety (SM-48)", permission: "report:read" },
  { key: "integrity", title: "Integrity: human-only refusals, cross-tenant = 0 (SM-49)", permission: "report:read" },
  { key: "network_value", title: "Network value (SM-50)", permission: "report:read" },
  { key: "calls_with_transcripts", title: "Calls with transcripts (SM-51)", permission: "report:read" },
  { key: "portal_copilot", title: "Portal Copilot (SM-52)", permission: "report:read" },
  { key: "campaign_copy", title: "Campaign copy (SM-53)", permission: "report:read" },
];

export function tilesFor(key: P5DashboardKey): readonly P5TileDef[] {
  return key === "ecosystem" ? ECOSYSTEM_TILES : PLATFORM_OUTCOME_TILES;
}

export const P5_EMPTY_STATE = "No data yet — turn on an integration to see activity here.";
export const P5_GAP_NOTE = "This tile's data isn't exposed by an endpoint yet.";

export type ApiRequestRow = { installation: string; requests: number; errors: number; error_rate: string };

/** The "API requests & error rate" tile table, derived from the installations read (requests/errors over 30 days). */
export function apiRequestRows(installations: readonly InstallationRow[] | undefined): ApiRequestRow[] {
  return (installations ?? [])
    .filter((i) => i.requests_30d > 0 || i.errors_30d > 0)
    .map((i) => ({
      installation: i.name,
      requests: i.requests_30d,
      errors: i.errors_30d,
      error_rate: i.requests_30d ? `${((i.errors_30d / i.requests_30d) * 100).toFixed(1)}%` : "—",
    }))
    .sort((a, b) => b.requests - a.requests);
}
