import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { goLiveErrorMessage } from "../api";
import { orderedKinds } from "../format";
import type { GoLiveKindOut } from "../types";
import { dependencyHint, dependsOn, topoOrderKinds } from "./kind-order";

const k = (kind: string, label: string, depends_on: GoLiveKindOut["depends_on"] = null, available = true): GoLiveKindOut => ({
  kind,
  label,
  available,
  owner_epic: null,
  depends_on,
});

const KINDS = [
  k("project_assignments", "Project assignments", ["project_roles", "workers"]),
  k("project_roles", "Project roles", ["projects"]),
  k("institutions", "Institutions"),
  k("projects", "Projects"),
  k("workers", "Workers"),
  k("referral_history", "Referral history", null, false),
];

describe("go-live kind ordering by depends_on", () => {
  it("puts dependencies first, stable otherwise", () => {
    expect(topoOrderKinds(KINDS).map((x) => x.kind)).toEqual([
      "institutions",
      "projects",
      "project_roles",
      "workers",
      "project_assignments",
      "referral_history",
    ]);
  });

  it("keeps the P2 load order and appends P3 kinds after their dependencies", () => {
    const out = orderedKinds([...KINDS, k("placements", "Placements", "workers")]).map((x) => x.kind);
    expect(out.indexOf("workers")).toBe(0);
    expect(out.indexOf("placements")).toBe(1);
    expect(out.indexOf("projects")).toBeLessThan(out.indexOf("project_roles"));
    expect(out.indexOf("project_roles")).toBeLessThan(out.indexOf("project_assignments"));
  });

  it("ignores unknown dependencies and survives cycles", () => {
    expect(topoOrderKinds([k("a", "A", ["missing"]), k("b", "B")]).map((x) => x.kind)).toEqual(["a", "b"]);
    expect(topoOrderKinds([k("a", "A", "b"), k("b", "B", "a")]).map((x) => x.kind)).toEqual(["a", "b"]);
    expect(dependsOn({ depends_on: "projects" })).toEqual(["projects"]);
  });
});

describe("dependency hints and errors", () => {
  it("names dependencies by label", () => {
    expect(dependencyHint(KINDS[1], KINDS)).toBe("Import Projects first");
    expect(dependencyHint(KINDS[0], KINDS)).toBe("Import Project roles and Workers first");
    expect(dependencyHint(KINDS[2], KINDS)).toBeNull();
  });

  it("explains a 422 dependency_missing apply error", () => {
    const e = new ApiError(422, "dependency_missing", "x", { requires: ["project_roles"], rows: [3, 4] });
    expect(goLiveErrorMessage(e, KINDS)).toBe("Import Project roles first, then apply this file again. 2 row(s) are affected; nothing was applied.");
    expect(goLiveErrorMessage(new ApiError(409, "dependency_missing", "x", {}))).toMatch(/haven't been imported yet/);
  });
});
