import { describe, expect, it } from "vitest";
import type { AccessReviewItem, ConsoleSummary, InstallationRow } from "./api";
import { consoleApi } from "./api";
import {
  activeConsoleTab,
  AUTO_REVOKE_WARNING,
  canCompleteReview,
  CONSOLE_TABS,
  decisionColor,
  decisionLabel,
  directionLabel,
  filterInstallations,
  installationTypeLabel,
  isConsoleTab,
  publisherLabel,
  readinessColor,
  readinessLabel,
  RESTRICTED_TRANSFER_BADGE,
  revokeReasonError,
  staleBadge,
  statusColor,
  summaryCards,
  VIEW_ONLY_NOTICE,
  violationLabel,
} from "./logic";

describe("console tabs", () => {
  it("has the seven spec tabs in order", () => {
    expect(CONSOLE_TABS.map((t) => t.label)).toEqual([
      "Installations",
      "Authorisations",
      "Webhooks",
      "MCP",
      "Data flows",
      "Policy events",
      "Test results",
    ]);
  });
  it("falls back to installations for an unknown tab", () => {
    expect(activeConsoleTab("bogus")).toBe("installations");
    expect(activeConsoleTab(null)).toBe("installations");
    expect(activeConsoleTab("data-flows")).toBe("data-flows");
    expect(isConsoleTab("mcp")).toBe(true);
    expect(isConsoleTab("nope")).toBe(false);
  });
});

describe("labels", () => {
  it("maps installation types and publishers", () => {
    expect(installationTypeLabel("api_key")).toBe("API key");
    expect(installationTypeLabel("app")).toBe("App");
    expect(publisherLabel("platform")).toBe("Talent OS");
    expect(publisherLabel(null)).toBe("—");
  });
  it("maps violation kinds to the spec labels", () => {
    expect(violationLabel("egress_refused")).toBe("Blocked address");
    expect(violationLabel("scope_refused")).toBe("Missing access");
    expect(violationLabel("human_only_refused")).toBe("Human-only action refused");
    expect(violationLabel("unknown")).toBe("unknown");
  });
  it("maps data-flow direction", () => {
    expect(directionLabel("out")).toBe("Sent to");
    expect(directionLabel("in")).toBe("Received from");
  });
  it("colours status", () => {
    expect(statusColor("active")).toBe("success");
    expect(statusColor("degraded")).toBe("warning");
    expect(statusColor("suspended")).toBe("danger");
    expect(statusColor(null)).toBe("subtle");
  });
  it("exposes the view-only and restricted-transfer copy", () => {
    expect(VIEW_ONLY_NOTICE).toContain("Integration Administrator");
    expect(RESTRICTED_TRANSFER_BADGE).toBe("Restricted transfer");
  });
});

describe("revoke dialog validation", () => {
  it("requires a non-empty reason", () => {
    expect(revokeReasonError("")).toBe("Enter a reason.");
    expect(revokeReasonError("   ")).toBe("Enter a reason.");
    expect(revokeReasonError("No longer needed")).toBeNull();
  });
});

describe("data-flow CSV link", () => {
  it("points at the masked streaming endpoint", () => {
    expect(consoleApi.dataFlowsCsvUrl()).toBe("/api/v1/ecosystem-console/data-flows.csv");
  });
});

describe("summary cards", () => {
  it("renders the six header cards and sums needs-attention", () => {
    const s: ConsoleSummary = {
      active: 3,
      degraded: 1,
      suspended: 2,
      pending_reconsents: 0,
      failing_subscriptions: 4,
      active_mcp_sessions: 1,
      open_access_review_items: 0,
      violations_7d: 5,
      kill_switch_on: false,
    };
    const cards = summaryCards(s);
    expect(cards.map((c) => c.label)).toEqual([
      "Active",
      "Needs attention",
      "Re-consent needed",
      "Failing webhooks",
      "MCP sessions now",
      "Policy events (7 days)",
    ]);
    expect(cards.find((c) => c.key === "attention")?.value).toBe(3);
    expect(cards.find((c) => c.key === "webhooks")?.color).toBe("danger");
  });
  it("handles missing summary", () => {
    expect(summaryCards(undefined).every((c) => c.value === 0)).toBe(true);
  });
});

describe("access reviews", () => {
  const item = (decision: string, stale = false, days?: number): AccessReviewItem => ({
    id: Math.random().toString(),
    kind: "installation_grant",
    subject_id: "s",
    snapshot: days === undefined ? {} : { days_since_use: days },
    stale,
    decision,
    note: null,
  });
  it("labels and colours decisions", () => {
    expect(decisionLabel("confirmed")).toBe("Kept");
    expect(decisionLabel("auto_revoked")).toBe("Auto-revoked");
    expect(decisionColor("revoked")).toBe("danger");
    expect(decisionColor("pending")).toBe("subtle");
  });
  it("builds a stale badge only for stale items", () => {
    expect(staleBadge(item("pending", false))).toBeNull();
    expect(staleBadge(item("pending", true, 120))).toBe("Not used for 120 days");
    expect(staleBadge(item("pending", true))).toBe("Not used recently");
  });
  it("completes only when open and every item decided", () => {
    const open = { status: "open" as const };
    expect(canCompleteReview(open, [item("confirmed"), item("revoked")])).toBe(true);
    expect(canCompleteReview(open, [item("confirmed"), item("pending")])).toBe(false);
    expect(canCompleteReview(open, [])).toBe(false);
    expect(canCompleteReview({ status: "completed" }, [item("confirmed")])).toBe(false);
  });
  it("warns before auto-revoke", () => {
    expect(AUTO_REVOKE_WARNING).toBe("People will be notified before access is removed.");
  });
});

describe("feature readiness", () => {
  it("maps readiness status to label and colour", () => {
    expect(readinessLabel("ok")).toBe("Ready");
    expect(readinessLabel("blocking")).toBe("Not ready");
    expect(readinessColor("ok")).toBe("success");
    expect(readinessColor("blocking")).toBe("danger");
    expect(readinessColor("warning")).toBe("warning");
  });
});

describe("installations filter", () => {
  const row = (name: string, kind: string): InstallationRow =>
    ({
      kind,
      id: name,
      name,
      publisher: null,
      version: null,
      granted_scopes: [],
      sensitive_scopes: [],
      status: null,
      health_status: null,
      last_activity_at: null,
      requests_30d: 0,
      errors_30d: 0,
      minutes_30d: 0,
      accountable_user: null,
    }) as InstallationRow;
  it("filters by kind and name", () => {
    const rows = [row("Keka", "connector"), row("My API key", "api_key"), row("Zoho", "connector")];
    expect(filterInstallations(rows, "connector", null).map((r) => r.name)).toEqual(["Keka", "Zoho"]);
    expect(filterInstallations(rows, null, "api").map((r) => r.name)).toEqual(["My API key"]);
    expect(filterInstallations(rows, null, null)).toHaveLength(3);
  });
});
