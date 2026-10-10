import { describe, expect, it } from "vitest";
import { demandFiltersToSearch, demandListQuery, EMPTY_DEMAND_FILTERS, parseDemandFilters } from "./query";
import { allowedActions, progressLabel, reasonLabel, slaBadge, STATUS_COLORS, STATUS_LABELS } from "./status";

const ALL = {
  "demand:update": "tenant",
  "demand:assign": "tenant",
  "demand:delete": "tenant",
};

describe("status labels", () => {
  it("maps every snake_case status to a label and colour", () => {
    expect(STATUS_LABELS.pending_approval).toBe("Pending approval");
    expect(STATUS_LABELS.on_hold).toBe("On hold");
    expect(STATUS_COLORS.open).toBe("brand");
  });

  it("labels progress", () => {
    expect(progressLabel("partially_filled")).toBe("Partially filled");
    expect(progressLabel(null)).toBe("—");
  });

  it("labels reason codes", () => {
    expect(reasonLabel("budget_pending")).toBe("Budget pending");
    expect(reasonLabel(null)).toBe("");
  });

  it("maps SLA statuses to badges", () => {
    expect(slaBadge("at_risk")).toEqual({ label: "At risk", color: "warning" });
    expect(slaBadge("breached")?.color).toBe("danger");
    expect(slaBadge(null)).toBeNull();
  });
});

describe("allowedActions (PRD §5.1)", () => {
  it("offers submit and cancel on a draft", () => {
    expect(allowedActions("draft", ALL)).toEqual(["edit", "submit", "cancel", "archive"]);
  });

  it("offers nothing but edit while pending approval", () => {
    expect(allowedActions("pending_approval", ALL)).toEqual(["edit"]);
  });

  it("offers hold, cancel, close, publish and assign on an open demand", () => {
    expect(allowedActions("open", ALL)).toEqual(["edit", "hold", "cancel", "close", "publish", "assign"]);
  });

  it("offers resume on hold, reopen when filled, and never hold from draft", () => {
    expect(allowedActions("on_hold", ALL)).toContain("resume");
    expect(allowedActions("filled", ALL)).toEqual(["edit", "reopen", "close"]);
    expect(allowedActions("draft", ALL)).not.toContain("hold");
  });

  it("offers only archive on terminal statuses and nothing when archived", () => {
    expect(allowedActions("closed", ALL)).toEqual(["archive"]);
    expect(allowedActions("cancelled", ALL, { archived: true })).toEqual([]);
  });

  it("filters by permission", () => {
    expect(allowedActions("open", { "demand:assign": "team" })).toEqual(["assign"]);
    expect(allowedActions("open", {})).toEqual([]);
  });
});

describe("demand list query", () => {
  it("round-trips filters through the page URL", () => {
    const filters = {
      ...EMPTY_DEMAND_FILTERS,
      q: "data",
      status: ["open" as const, "on_hold" as const],
      priority: ["high" as const],
      assignedTo: "me",
      page: 2,
    };
    const search = demandFiltersToSearch(filters);
    expect(parseDemandFilters(new URLSearchParams(search))).toEqual(filters);
  });

  it("drops unknown values", () => {
    const f = parseDemandFilters(new URLSearchParams("status=open,bogus&priority=urgent&assigned_to=x&page=-1&sort=name"));
    expect(f.status).toEqual(["open"]);
    expect(f.priority).toEqual([]);
    expect(f.assignedTo).toBeNull();
    expect(f.page).toBe(1);
    expect(f.sort).toBe("-created_at");
  });

  it("repeats array params for the API", () => {
    const q = demandListQuery({ ...EMPTY_DEMAND_FILTERS, status: ["open", "draft"] }, 20);
    expect(q).toBe("page=1&page_size=20&status=open&status=draft&sort=-created_at");
  });
});
