import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { SettingsCatalogEntry } from "@/lib/api/types";
import { applySettingsErrors, idPrefixErrors, isPhase3Owner, settingsFieldErrors, settingsRows } from "./catalog";

const entry = (key: string, category: string, available = true): SettingsCatalogEntry => ({
  key,
  category,
  label: key,
  description: "",
  endpoint: `/api/v1/${key}`,
  available,
  summary: null,
});

describe("settings panel 422 mapping", () => {
  it("maps the dict form, including nested paths", () => {
    const e = new ApiError(422, "validation_failed", "Validation failed", {
      fields: { timezone: "Unknown time zone", "grievance_officer.email": "Invalid email" },
    });
    expect(settingsFieldErrors(e)).toEqual({ timezone: "Unknown time zone", "grievance_officer.email": "Invalid email" });
  });
  it("maps the request-validation list form and strips body.", () => {
    const e = new ApiError(422, "validation_failed", "x", {
      fields: [
        { field: "body.currency", message: "Bad currency" },
        { field: "body.currency", message: "second" },
      ],
    });
    expect(settingsFieldErrors(e)).toEqual({ currency: "Bad currency" });
  });
  it("ignores non-422 errors", () => {
    expect(settingsFieldErrors(new ApiError(409, "conflict", "x", { fields: { a: "b" } }))).toEqual({});
    expect(settingsFieldErrors(new Error("x"))).toEqual({});
  });
});

describe("settings catalog rows", () => {
  it("opens panels, links owned pages and marks unavailable entries", () => {
    const rows = settingsRows(
      [entry("company", "organization"), entry("ai_features", "services"), entry("stages", "services", false), entry("x", "services")],
      "services",
    );
    expect(rows.map((r) => [r.key, r.action, r.href])).toEqual([
      ["ai_features", "link", "/admin/ai"],
      ["stages", "none", undefined],
      ["x", "none", undefined],
    ]);
    expect(settingsRows([entry("company", "organization")], "organization")[0].action).toBe("panel");
  });
});

describe("Phase 3 settings entries (Epic 52)", () => {
  it("hides unavailable Phase 3 entries and links available ones", () => {
    const p3 = (key: string, available: boolean) => ({ ...entry(key, "recruiting", available), owner_epic: "Epic 39" });
    const rows = settingsRows([p3("marketing", true), p3("campus", false)], "recruiting");
    expect(rows.map((r) => [r.key, r.action, r.href])).toEqual([["marketing", "link", "/marketing/settings"]]);
    expect(isPhase3Owner("Epic 52")).toBe(true);
    expect(isPhase3Owner("Epic 35")).toBe(false);
    expect(isPhase3Owner(null)).toBe(false);
  });
});

describe("ID prefixes", () => {
  it("requires unique 2-5 capital letters", () => {
    expect(idPrefixErrors({ REQ: "REQ", CAN: "CND", APP: "CND", SUB: "s", DSR: "DSRXXX" })).toEqual({
      APP: "Already used for CAN",
      SUB: "Use 2–5 capital letters",
      DSR: "Use 2–5 capital letters",
    });
  });
});

describe("settings panel setError", () => {
  it("sets known fields (focusing the first) and returns the rest", () => {
    const calls: [string, string, boolean | undefined][] = [];
    const setError = (name: never, err: { message: string }, opts?: { shouldFocus: boolean }) => {
      calls.push([name as string, err.message, opts?.shouldFocus]);
    };
    const e = new ApiError(422, "validation_failed", "x", {
      fields: { timezone: "Unknown time zone", currency: "Bad", legacy: "Other problem" },
    });
    expect(applySettingsErrors(e, setError, ["timezone", "currency"])).toEqual(["legacy: Other problem"]);
    expect(calls).toEqual([
      ["timezone", "Unknown time zone", true],
      ["currency", "Bad", false],
    ]);
  });
});
