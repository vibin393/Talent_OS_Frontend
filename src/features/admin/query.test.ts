import { describe, expect, it } from "vitest";
import { EMPTY_USER_FILTERS, hasActiveFilters, pageParams, pageRange, userListQuery } from "./query";

describe("userListQuery", () => {
  it("sends only paging for empty filters", () => {
    expect(userListQuery(EMPTY_USER_FILTERS, 1)).toBe("page=1&page_size=20");
  });

  it("maps every filter to the API parameter names", () => {
    const qs = new URLSearchParams(
      userListQuery(
        { q: "  ann@x.io ", status: "inactive", roleId: "r1", teamId: "t1", businessUnitId: "b1" },
        3,
        50,
      ),
    );
    expect(Object.fromEntries(qs)).toEqual({
      page: "3",
      page_size: "50",
      q: "ann@x.io",
      is_active: "false",
      role_id: "r1",
      team_id: "t1",
      business_unit_id: "b1",
    });
  });

  it("maps active status and omits blank search", () => {
    const qs = new URLSearchParams(userListQuery({ ...EMPTY_USER_FILTERS, q: "   ", status: "active" }, 1));
    expect(qs.get("is_active")).toBe("true");
    expect(qs.has("q")).toBe(false);
  });

  it("encodes special characters and caps the search length", () => {
    const qs = new URLSearchParams(userListQuery({ ...EMPTY_USER_FILTERS, q: "a&b=c" }, 1));
    expect(qs.get("q")).toBe("a&b=c");
    const long = new URLSearchParams(userListQuery({ ...EMPTY_USER_FILTERS, q: "x".repeat(500) }, 1));
    expect(long.get("q")).toHaveLength(200);
  });
});

describe("pageParams", () => {
  it("clamps invalid pages and sizes to the backend limits", () => {
    expect(pageParams(0, 1000).toString()).toBe("page=1&page_size=100");
    expect(pageParams(Number.NaN, -5).toString()).toBe("page=1&page_size=20");
    expect(pageParams(2.7, 10).toString()).toBe("page=2&page_size=10");
  });
});

describe("pageRange", () => {
  it("computes ranges and page counts", () => {
    expect(pageRange(1, 20, 45)).toEqual({ from: 1, to: 20, pageCount: 3 });
    expect(pageRange(3, 20, 45)).toEqual({ from: 41, to: 45, pageCount: 3 });
    expect(pageRange(1, 20, 0)).toEqual({ from: 0, to: 0, pageCount: 1 });
  });
});

describe("hasActiveFilters", () => {
  it("detects any non-default filter", () => {
    expect(hasActiveFilters(EMPTY_USER_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_USER_FILTERS, q: " " })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_USER_FILTERS, teamId: "t" })).toBe(true);
  });
});
