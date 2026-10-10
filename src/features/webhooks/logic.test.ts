import { describe, expect, it } from "vitest";
import type { EventType } from "./api";
import {
  allowedFilterFields,
  canAddFilter,
  disabledMessage,
  endpointLabel,
  groupEventTypes,
  pollInterval,
  replayRangeError,
  streakLabel,
  subscriptionBadge,
} from "./logic";

const t = (type: string, props: string[], allowed = true): EventType => ({
  type,
  version: 1,
  description: "",
  scopes: [],
  allowed,
  requires: allowed ? [] : ["placements:read"],
  schema: { properties: Object.fromEntries(props.map((p) => [p, {}])) },
  example: {},
});

describe("status badge", () => {
  it("labels every status and reason", () => {
    expect(subscriptionBadge({ status: "pending_verification", disabled_reason: null, paused: false })).toMatchObject({
      label: "Pending verification",
      intent: "warning",
    });
    expect(subscriptionBadge({ status: "active", disabled_reason: null, paused: false })).toMatchObject({ label: "Active", intent: "success" });
    expect(subscriptionBadge({ status: "active", disabled_reason: null, paused: true })).toMatchObject({ label: "Paused", intent: "informative" });
    const gone = subscriptionBadge({ status: "disabled", disabled_reason: "gone", paused: false });
    expect(gone).toMatchObject({ label: "Turned off", intent: "danger" });
    expect(gone.tooltip).toBe("Turned off because the endpoint returned 410 Gone");
    expect(disabledMessage("failing")).toBe("Turned off because deliveries failed for 72 hours");
    expect(disabledMessage("egress_refused")).toContain("private network address");
    expect(disabledMessage("uninstalled")).toContain("uninstalled");
    expect(disabledMessage("scope_lost")).toContain("no longer has access");
    expect(disabledMessage(null)).toBeNull();
  });
});

describe("event picker", () => {
  it("groups by subject and keeps disallowed types", () => {
    const groups = groupEventTypes([t("placement.started", []), t("timesheet.approved", [], false), t("candidate.created", [])]);
    expect(groups.map((g) => g.label)).toEqual(["Candidates", "Placements", "Timesheets"]);
    expect(groups[2].types[0].allowed).toBe(false);
  });
});

describe("filters editor", () => {
  const catalogue = [t("invoice.issued", ["id", "client_id", "legal_entity_id"]), t("payment.recorded", ["id", "client_id"])];
  it("allows the fields common to the selection", () => {
    expect(allowedFilterFields(["invoice.issued"], false, catalogue)).toEqual(["client_id", "legal_entity_id"]);
    expect(allowedFilterFields(["invoice.issued", "payment.recorded"], false, catalogue)).toEqual(["client_id"]);
    expect(allowedFilterFields([], true, catalogue)).toEqual(["client_id", "legal_entity_id"]);
    expect(allowedFilterFields([], false, catalogue)).toEqual([]);
  });
  it("caps at 3 filters", () => {
    const all = ["client_id", "demand_id", "legal_entity_id", "placement_id"];
    expect(canAddFilter({ client_id: [], demand_id: [] }, all)).toBe(true);
    expect(canAddFilter({ client_id: [], demand_id: [], legal_entity_id: [] }, all)).toBe(false);
    expect(canAddFilter({ client_id: [] }, ["client_id"])).toBe(false);
  });
});

describe("deliveries grid polling", () => {
  it("polls every 15 s only while a row is moving", () => {
    expect(pollInterval([{ status: "succeeded" }, { status: "failed" }])).toBe(false);
    expect(pollInterval([{ status: "succeeded" }, { status: "retrying" }])).toBe(15_000);
    expect(pollInterval([{ status: "in_flight" }])).toBe(15_000);
    expect(pollInterval(undefined)).toBe(false);
  });
});

describe("replay range", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it("enforces the 30-day bound", () => {
    expect(replayRangeError(new Date("2026-10-09T00:00:00Z"), new Date("2026-10-10T00:00:00Z"), now)).toBeNull();
    expect(replayRangeError(new Date("2026-10-10T00:00:00Z"), new Date("2026-10-09T00:00:00Z"), now)).toContain("after");
    expect(replayRangeError(new Date("2026-08-01T00:00:00Z"), new Date("2026-10-01T00:00:00Z"), now)).toBe("Pick at most 30 days.");
    expect(replayRangeError(new Date("2026-09-01T00:00:00Z"), new Date("2026-09-05T00:00:00Z"), now)).toContain("older than 30 days");
  });
});

describe("labels", () => {
  it("hides the query string and formats streaks", () => {
    expect(endpointLabel("https://hooks.example.com/in?token=secret")).toBe("hooks.example.com/in");
    expect(streakLabel(null)).toBe("None");
    expect(streakLabel("2026-10-10T08:50:00Z", new Date("2026-10-10T12:00:00Z"))).toBe("Failing for 3 h 10 min");
  });
});
