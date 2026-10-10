import { describe, expect, it } from "vitest";
import type { InstallationRow } from "@/features/ecosystem-console/api";
import {
  apiRequestRows,
  ECOSYSTEM_TILES,
  P5_EMPTY_STATE,
  P5_TAB_LABELS,
  P5_TAB_PERMISSION,
  PLATFORM_OUTCOME_TILES,
  tilesFor,
} from "./tile-model";

describe("p5 dashboard tabs", () => {
  it("labels and gates the two tabs per spec", () => {
    expect(P5_TAB_LABELS.ecosystem).toBe("Ecosystem");
    expect(P5_TAB_LABELS.platform_outcomes).toBe("Platform outcomes");
    expect(P5_TAB_PERMISSION.ecosystem).toBe("integration:view");
    expect(P5_TAB_PERMISSION.platform_outcomes).toBe("report:read");
  });
  it("carries the spec tile titles", () => {
    expect(ECOSYSTEM_TILES[0].title).toBe("API requests & error rate");
    expect(ECOSYSTEM_TILES.map((t) => t.title)).toContain("Job Network performance");
    expect(PLATFORM_OUTCOME_TILES.map((t) => t.title)).toContain("Network value (SM-50)");
    expect(tilesFor("ecosystem")).toBe(ECOSYSTEM_TILES);
    expect(tilesFor("platform_outcomes")).toBe(PLATFORM_OUTCOME_TILES);
  });
  it("has an empty state", () => {
    expect(P5_EMPTY_STATE).toContain("No data yet");
  });
});

describe("apiRequestRows", () => {
  const inst = (name: string, requests: number, errors: number): InstallationRow =>
    ({
      kind: "app",
      id: name,
      name,
      publisher: null,
      version: null,
      granted_scopes: [],
      sensitive_scopes: [],
      status: null,
      health_status: null,
      last_activity_at: null,
      requests_30d: requests,
      errors_30d: errors,
      minutes_30d: 0,
      accountable_user: null,
    }) as InstallationRow;

  it("derives request/error rows sorted by volume, dropping idle installations", () => {
    const rows = apiRequestRows([inst("A", 100, 10), inst("B", 0, 0), inst("C", 200, 0)]);
    expect(rows.map((r) => r.installation)).toEqual(["C", "A"]);
    expect(rows[1].error_rate).toBe("10.0%");
    expect(rows[0].error_rate).toBe("0.0%");
  });
  it("handles no installations", () => {
    expect(apiRequestRows(undefined)).toEqual([]);
  });
});
