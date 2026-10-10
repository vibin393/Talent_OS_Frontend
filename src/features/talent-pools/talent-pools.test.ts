import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  canEditMembers,
  diffText,
  matchingPoolsText,
  pipelineResultText,
  reasonTags,
  refreshErrorMessage,
  templateErrorMessage,
  templateNeedsBatch,
  templateStatus,
  visibilityOptions,
} from "./logic";
import type { PoolTemplate } from "./types";

function template(over: Partial<PoolTemplate>): PoolTemplate {
  return {
    key: "silver_medalists",
    name: "Silver Medalists",
    description: null,
    source_key: "candidates.candidate",
    enabled: false,
    available: true,
    unavailable_reason: null,
    pool_id: null,
    ...over,
  };
}

describe("template availability", () => {
  it("renders an available template as enableable", () => {
    expect(templateStatus(template({}))).toEqual({ label: "Available", color: "informative", canEnable: true, reason: null });
  });

  it("renders an enabled template without Enable", () => {
    const s = templateStatus(template({ enabled: true, pool_id: "p1" }));
    expect(s.label).toBe("Enabled");
    expect(s.canEnable).toBe(false);
  });

  it("renders an unavailable template disabled with its reason (or a default)", () => {
    const s = templateStatus(template({ key: "campus_2027", available: false, unavailable_reason: "Needs the campus batch field (Epic 43)." }));
    expect(s).toMatchObject({ label: "Unavailable", canEnable: false, reason: "Needs the campus batch field (Epic 43)." });
    expect(templateStatus(template({ available: false, unavailable_reason: " " })).reason).toBe(
      "The fields this template needs are not available yet.",
    );
  });

  it("asks for a batch only for campus templates", () => {
    expect(templateNeedsBatch({ key: "campus_2027" })).toBe(true);
    expect(templateNeedsBatch({ key: "bench" })).toBe(false);
  });

  it("maps template and refresh errors", () => {
    expect(templateErrorMessage(new ApiError(409, "template_unavailable", "x"))).toMatch(/not available/);
    expect(templateErrorMessage(new ApiError(409, "template_enabled", "x"))).toMatch(/already enabled/);
    expect(templateErrorMessage(new Error("x"))).toBeNull();
    expect(refreshErrorMessage(new ApiError(429, "rate_limited", "x"))).toMatch(/5 minutes/);
    expect(refreshErrorMessage(new ApiError(500, "internal_error", "x"))).toBeNull();
  });
});

describe("pool display helpers", () => {
  it("formats refresh diffs", () => {
    expect(diffText({ added: 3, removed: 1 })).toBe("+3 / −1");
    expect(diffText({ added: 0, removed: 0 })).toBe("No changes");
    expect(diffText(null)).toBe("—");
  });

  it("offers organization visibility only with pool:manage", () => {
    expect(visibilityOptions(false)).toEqual(["private", "team"]);
    expect(visibilityOptions(true)).toEqual(["private", "team", "tenant"]);
  });

  it("builds reason tags from matched criteria and skill weights", () => {
    expect(
      reasonTags(
        { segment_id: "s", version: 2, matched: [{ field: "notice_period_days", op: "lte", label: "Notice ≤ 30 days" }], skills: [{ skill_key: "java", weight: "1" }, { skill_key: "kotlin", weight: "0.6" }] },
        "segment",
      ),
    ).toEqual(["Notice ≤ 30 days", "java", "kotlin (60%)"]);
    expect(reasonTags(null, "legacy_list")).toEqual(["Saved list"]);
    expect(reasonTags({ added_by: "u1" }, "manual")).toEqual(["Added by hand"]);
  });

  it("summarises add-to-pipeline results", () => {
    const item = (status: "created" | "exists" | "error") => ({
      candidate_id: status,
      status,
      application_id: null,
      existing_application_id: null,
      error: null,
    });
    expect(pipelineResultText([item("created"), item("created"), item("exists"), item("error")])).toBe(
      "2 added, 1 already in the pipeline, 1 failed",
    );
  });

  it("renders the matching pools count for the rediscovery card", () => {
    expect(matchingPoolsText(0)).toBe("");
    expect(matchingPoolsText(undefined)).toBe("");
    expect(matchingPoolsText(1)).toBe("1 matching Pool");
    expect(matchingPoolsText(4)).toBe("4 matching Pools");
  });

  it("allows manual member changes on active static pools only", () => {
    expect(canEditMembers({ kind: "static", can_edit: true, status: "active" })).toBe(true);
    expect(canEditMembers({ kind: "dynamic", can_edit: true, status: "active" })).toBe(false);
    expect(canEditMembers({ kind: "static", can_edit: false, status: "active" })).toBe(false);
    expect(canEditMembers({ kind: "static", can_edit: true, status: "archived" })).toBe(false);
  });
});
