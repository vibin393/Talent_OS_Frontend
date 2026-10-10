import { describe, expect, it } from "vitest";
import { demandExportFilters, demandListQuery, EMPTY_DEMAND_FILTERS, parseDemandFilters } from "@/features/demands/query";
import { formatReportCell, visibleColumns } from "./format";
import {
  hasReportFilters,
  hiddenFilterLabels,
  parseReportParams,
  reportExportFilters,
  reportListQuery,
  reportParamsToSearch,
  sortState,
  toSort,
  withFilter,
} from "./query";

const BU = "0f6cbd00-0000-4000-8000-000000000001";

describe("report list filters <-> URL", () => {
  it("parses a dashboard drill-down link and keeps only known filters", () => {
    const p = parseReportParams(
      "submissions",
      new URLSearchParams(`sent_by=me&from=2026-09-28&to=2026-10-04&business_unit_ids=${BU}&bogus=1&src=dashboard&sort=-sent_at&page=2`),
    );
    expect(p).toEqual({
      filters: { sent_by: ["me"], from: ["2026-09-28"], to: ["2026-10-04"], business_unit_ids: [BU] },
      sort: "-sent_at",
      page: 2,
      fromDashboard: true,
    });
    expect(parseReportParams("submissions", new URLSearchParams(reportParamsToSearch(p)))).toEqual(p);
  });

  it("drops malformed sort and paging", () => {
    const p = parseReportParams("offers", new URLSearchParams("status=released,viewed&sort=drop table&page=0"));
    expect(p).toEqual({ filters: { status: ["released,viewed"] }, sort: null, page: 1, fromDashboard: false });
  });

  it("builds the API query and the export filters from the same state", () => {
    const p = withFilter(parseReportParams("submissions", new URLSearchParams("db_sourced=true&older_than=3&page=3")), "feedback", "none");
    expect(p.page).toBe(1);
    expect(reportListQuery(p, 20)).toBe("page=1&page_size=20&older_than=3&db_sourced=true&feedback=none");
    expect(reportExportFilters({ ...p, sort: "-sent_at" })).toEqual({ older_than: 3, db_sourced: true, feedback: "none", sort: "-sent_at" });
    expect(reportExportFilters(parseReportParams("applications", new URLSearchParams(`business_unit_ids=${BU}`)))).toEqual({
      business_unit_ids: [BU],
    });
  });

  it("clears a filter and reports hidden drill-down filters", () => {
    const p = parseReportParams("applications", new URLSearchParams("scope=mine&stage=applied&source=manual"));
    expect(hasReportFilters(p)).toBe(true);
    expect(hiddenFilterLabels("applications", p)).toEqual(["my pipeline"]);
    expect(withFilter(p, "stage", null).filters).toEqual({ scope: ["mine"], source: ["manual"] });
    expect(hiddenFilterLabels("submissions", parseReportParams("submissions", new URLSearchParams("sent_by=me")))).toEqual([]);
  });

  it("maps grid sort state to the API sort", () => {
    expect(sortState("-sent_at")).toEqual({ sortColumn: "sent_at", sortDirection: "descending" });
    expect(toSort("candidate", "ascending")).toBe("candidate");
  });
});

describe("report cells", () => {
  it("formats by column type and hides internal columns", () => {
    expect(formatReportCell({ amount: "1500.00", currency: "INR" }, { type: "money" })).toMatch(/^INR 1,?500\.00$/);
    expect(formatReportCell("pending_approval", { type: "enum" })).toBe("Pending approval");
    expect(formatReportCell(null, { type: "string" })).toBe("—");
    const cols = [
      { key: "candidate", label: "Candidate", type: "string", compensation: false, pii: true, masked: false, sortable: true },
      { key: "stage_key", label: "Stage key", type: "string", compensation: false, pii: false, masked: false, sortable: true },
      { key: "demand_id", label: "Demand id", type: "uuid", compensation: false, pii: false, masked: false, sortable: false },
    ];
    expect(visibleColumns(cols).map((c) => c.key)).toEqual(["candidate"]);
  });
});

describe("demand list drill-down filters", () => {
  it("accepts the dashboard aliases and forwards drill-down filters", () => {
    const f = parseDemandFilters(
      new URLSearchParams(`status=open&assignee=me&sla=at_risk&opened_from=2026-09-01&opened_to=2026-09-30&business_unit_ids=${BU}&client_owner=me`),
    );
    expect(f).toMatchObject({ assignedTo: "me", slaStatus: "at_risk", openedFrom: "2026-09-01", openedTo: "2026-09-30", businessUnitIds: [BU], clientOwner: "me" });
    expect(demandListQuery(f, 20)).toContain(`opened_from=2026-09-01&opened_to=2026-09-30&business_unit_ids=${BU}&client_owner=me`);
    expect(demandExportFilters(f)).toMatchObject({ status: ["open"], assigned_to: "me", sla_status: "at_risk", business_unit_ids: [BU] });
    const cleared = { ...f, ...EMPTY_DEMAND_FILTERS };
    expect(cleared.openedFrom).toBeUndefined();
    expect(cleared.businessUnitIds).toBeUndefined();
  });
});
