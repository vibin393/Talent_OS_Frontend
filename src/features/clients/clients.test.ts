import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { clientErrorMessage } from "./errors";
import { cleanLocations, formatLocations, isValidGstin, websiteLabel } from "./format";
import { clientListQuery, DEFAULT_CLIENT_SORT, EMPTY_CLIENT_FILTERS, hasClientFilters, sortParam } from "./query";

describe("clientListQuery", () => {
  it("sends paging and the default sort only for empty filters", () => {
    expect(clientListQuery(EMPTY_CLIENT_FILTERS, DEFAULT_CLIENT_SORT, 1, 20)).toBe("page=1&page_size=20&sort=name");
  });

  it("maps every filter and descending sort", () => {
    const qs = new URLSearchParams(
      clientListQuery(
        { q: "  acme ", status: "active", ownerId: "u1", includeArchived: true },
        { field: "updated_at", direction: "descending" },
        3,
        500,
      ),
    );
    expect(Object.fromEntries(qs)).toEqual({
      page: "3",
      page_size: "100",
      q: "acme",
      status: "active",
      owner_id: "u1",
      include_archived: "true",
      sort: "-updated_at",
    });
  });

  it("detects active filters", () => {
    expect(hasClientFilters(EMPTY_CLIENT_FILTERS)).toBe(false);
    expect(hasClientFilters({ ...EMPTY_CLIENT_FILTERS, q: " " })).toBe(false);
    expect(hasClientFilters({ ...EMPTY_CLIENT_FILTERS, includeArchived: true })).toBe(true);
    expect(sortParam({ field: "status", direction: "ascending" })).toBe("status");
  });
});

describe("client formatting", () => {
  it("validates GSTIN like the backend (case-insensitive, blank allowed)", () => {
    expect(isValidGstin("")).toBe(true);
    expect(isValidGstin("22aaaaa0000a1z5")).toBe(true);
    expect(isValidGstin("12ABC")).toBe(false);
    expect(isValidGstin("22AAAAA0000A0Z5")).toBe(false);
  });

  it("formats and cleans locations", () => {
    expect(formatLocations([])).toBe("—");
    expect(
      formatLocations([
        { city: "Pune", state: "MH", country: "India" },
        { city: "Austin", state: null, country: "USA" },
      ]),
    ).toBe("Pune, MH, India; Austin, USA");
    expect(formatLocations(Array.from({ length: 5 }, () => ({ city: "X", state: null, country: "Y" })), 2)).toBe(
      "X, Y; X, Y +3 more",
    );
    expect(
      cleanLocations([
        { city: " Pune ", state: " ", country: "India" },
        { city: "", state: "", country: "" },
      ]),
    ).toEqual([{ city: "Pune", state: null, country: "India" }]);
  });

  it("shows the website host", () => {
    expect(websiteLabel("https://www.acme.com/about")).toBe("www.acme.com");
    expect(websiteLabel("not a url")).toBe("not a url");
    expect(websiteLabel(null)).toBe("");
  });
});

describe("clientErrorMessage", () => {
  it("maps known codes and falls back to the admin mapping", () => {
    expect(clientErrorMessage(new ApiError(409, "client_exists", "x"))).toMatch(/already exists/);
    expect(clientErrorMessage(new ApiError(409, "contact_exists", "x"))).toMatch(/contact/);
    expect(clientErrorMessage(new ApiError(404, "not_found", "x"))).toMatch(/no longer exists/);
    expect(clientErrorMessage(new ApiError(403, "forbidden", "x", { permission: "client:update" }))).toMatch(
      /client:update/,
    );
  });
});

describe("canActOnOwned", () => {
  it("allows wider scopes and restricts own scope to the owner", async () => {
    const { canActOnOwned } = await import("./access");
    expect(canActOnOwned({ "client:update": "tenant" }, "client:update", "u2", "u1")).toBe(true);
    expect(canActOnOwned({ "client:update": "team" }, "client:update", "u2", "u1")).toBe(true);
    expect(canActOnOwned({ "client:update": "own" }, "client:update", "u1", "u1")).toBe(true);
    expect(canActOnOwned({ "client:update": "own" }, "client:update", "u2", "u1")).toBe(false);
    expect(canActOnOwned({}, "client:update", "u1", "u1")).toBe(false);
  });
});

describe("parseClientTab", () => {
  it("accepts known tabs only", async () => {
    const { parseClientTab } = await import("./query");
    expect(parseClientTab("contacts")).toBe("contacts");
    expect(parseClientTab("activity")).toBe("activity");
    expect(parseClientTab("nope")).toBe("overview");
    expect(parseClientTab(["contacts"])).toBe("overview");
    expect(parseClientTab(undefined)).toBe("overview");
  });
});

describe("Clients nav item", () => {
  it("is shown only with client:read", async () => {
    const { NAV_ITEMS, visibleNavItems } = await import("@/components/app-shell/nav-items");
    const labels = (p: Record<string, string>) => visibleNavItems(NAV_ITEMS, p).map((i) => i.label);
    expect(labels({})).not.toContain("Clients");
    expect(labels({ "client:read": "own" })).toContain("Clients");
  });
});
