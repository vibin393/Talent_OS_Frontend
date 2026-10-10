import { describe, expect, it } from "vitest";
import { CLIENT_NAV } from "@/app/client/nav-items";
import { missingSowTerms, sowTermsError, valueCapLabel } from "@/features/commercials/sow";
import { ApiError } from "@/lib/api/errors";
import {
  acceptanceError,
  buildTimelineGrid,
  burnScale,
  deliverableActions,
  rejectionError,
  sortPortalDeliverables,
  splitText,
  weeksBetween,
  weekStart,
} from "./logic";
import type { ResourceTimeline } from "./types";

const FIXTURE: ResourceTimeline = {
  from_date: "2026-10-05", // Monday
  to_date: "2026-11-01", // Sunday: 4 weeks
  roles: [
    {
      project_role_id: "r1",
      title: "Frontend dev",
      headcount: 2,
      segments: [
        { start: "2026-10-05", end: "2026-10-18", assigned_fte: "2", headcount: 2, gap: false },
        { start: "2026-10-19", end: "2026-11-01", assigned_fte: "1", headcount: 2, gap: true },
      ],
    },
  ],
  workers: [
    {
      candidate_id: "c1",
      placement_id: "p1",
      worker_name: "Asha Rao",
      segments: [
        { start: "2026-10-05", end: "2026-10-11", total_pct: "100", over: false, split: [{ project_id: "x", project_name: "Alpha", allocation_pct: "100" }] },
        {
          start: "2026-10-12",
          end: "2026-10-25",
          total_pct: "150",
          over: true,
          split: [
            { project_id: "x", project_name: "Alpha", allocation_pct: "100" },
            { project_id: "y", project_name: "Beta", allocation_pct: "50" },
          ],
        },
      ],
    },
  ],
  gap_count: 1,
  over_allocation_count: 1,
};

describe("resource timeline grid", () => {
  it("builds Monday weeks", () => {
    expect(weekStart("2026-10-08")).toBe("2026-10-05");
    expect(weeksBetween(FIXTURE.from_date, FIXTURE.to_date)).toEqual(["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
  });

  it("flags role gaps in the weeks they occur", () => {
    const [role] = buildTimelineGrid(FIXTURE);
    expect(role.kind).toBe("role");
    expect(role.cells.map((c) => c.state)).toEqual(["ok", "ok", "gap", "gap"]);
    expect(role.cells[2].text).toBe("1/2");
    expect(role.cells[0].text).toBe("2/2");
  });

  it("flags over-allocated workers with the split for the tooltip", () => {
    const worker = buildTimelineGrid(FIXTURE)[1];
    expect(worker.kind).toBe("worker");
    expect(worker.cells.map((c) => c.state)).toEqual(["ok", "over", "over", "empty"]);
    expect(worker.cells[1].text).toBe("150%");
    expect(splitText(worker.cells[1].split)).toBe("Alpha 100% · Beta 50%");
  });

  it("renders nothing for an empty timeline", () => {
    expect(buildTimelineGrid({ ...FIXTURE, roles: [], workers: [] })).toEqual([]);
  });
});

describe("deliverable acceptance flow", () => {
  it("requires evidence to record acceptance", () => {
    expect(acceptanceError(null)).toMatch(/evidence/i);
    expect(acceptanceError(new Blob([]))).toMatch(/empty/i);
    expect(acceptanceError(new Blob(["signed"]))).toBeNull();
  });

  it("requires a rejection reason of 3+ characters", () => {
    expect(rejectionError("  no")).not.toBeNull();
    expect(rejectionError("Missing tests")).toBeNull();
  });

  it("offers record acceptance only once submitted", () => {
    expect(deliverableActions("in_progress")).toEqual(["submit", "cancel"]);
    expect(deliverableActions("submitted")).toContain("record_acceptance");
    expect(deliverableActions("planned")).not.toContain("record_acceptance");
    expect(deliverableActions("accepted")).toEqual([]);
  });

  it("lists deliverables awaiting acceptance first in the portal", () => {
    const sorted = sortPortalDeliverables([
      { status: "accepted", due_date: "2026-01-01" },
      { status: "in_progress", due_date: "2026-02-01" },
      { status: "submitted", due_date: "2026-03-01" },
    ]);
    expect(sorted.map((d) => d.status)).toEqual(["submitted", "in_progress", "accepted"]);
  });
});

describe("budget bar", () => {
  it("places 80/100 markers relative to the budget", () => {
    const s = burnScale("50", "100", "90")!;
    expect(s.mark100).toBeCloseTo(100 / 120);
    expect(s.mark80).toBeCloseTo(80 / 120);
    expect(s.actual).toBeCloseTo(50 / 120);
    expect(burnScale("0", null, null)).toBeNull();
  });
});

describe("client portal nav gating", () => {
  const visible = (perms: string[]) => CLIENT_NAV.filter((n) => !n.adminOnly && (!n.permission || perms.includes(n.permission))).map((n) => n.href);

  it("shows Projects only with projects:view", () => {
    expect(CLIENT_NAV.find((n) => n.href === "/client/projects")?.permission).toBe("projects:view");
    expect(visible(["invoices:view"])).not.toContain("/client/projects");
    expect(visible(["projects:view"])).toContain("/client/projects");
  });
});

describe("SOW form required fields", () => {
  it("labels value_cap as Total value for SOWs", () => {
    expect(valueCapLabel("sow")).toBe("Total value");
    expect(valueCapLabel("msa")).not.toBe("Total value");
  });

  it("requires pricing model and total value only for SOWs", () => {
    expect(missingSowTerms({ contract_type: "sow", pricing_model: null, value_cap: null })).toEqual(["pricing_model", "value_cap"]);
    expect(missingSowTerms({ contract_type: "sow", pricing_model: "fixed_price", value_cap: "0" })).toEqual(["value_cap"]);
    expect(missingSowTerms({ contract_type: "sow", pricing_model: "milestone", value_cap: "500000.00" })).toEqual([]);
    expect(missingSowTerms({ contract_type: "msa", pricing_model: null, value_cap: null })).toEqual([]);
  });

  it("maps the 422 sow_terms_required error to fields", () => {
    const e = new ApiError(422, "sow_terms_required", "SOW terms required", { fields: [{ field: "pricing_model", message: "required" }] });
    expect(sowTermsError(e)).toEqual(["pricing_model"]);
    expect(sowTermsError(new ApiError(422, "sow_terms_required", "x"))).toEqual(["pricing_model", "value_cap"]);
    expect(sowTermsError(new ApiError(422, "validation_error", "x"))).toBeNull();
  });
});
