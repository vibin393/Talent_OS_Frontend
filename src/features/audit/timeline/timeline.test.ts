import { describe, expect, it } from "vitest";
import { timelineQuery } from "./api";
import { actionKind, actorName, changeValueText, diffRows, externalPrincipalLabel } from "./format";

describe("timeline masking", () => {
  it("shows masked values exactly as the server sent them", () => {
    expect(changeValueText("••••1234", true)).toBe("••••1234");
    expect(diffRows([{ field: "bank_account", old: "••••1234", new: "••••9876", masked: true }])).toEqual([
      { field: "Bank account", old: "••••1234", new: "••••9876", masked: true },
    ]);
  });
  it("never reveals a structured masked value", () => {
    expect(changeValueText({ raw: "secret" }, true)).toBe("••••");
    expect(changeValueText(null, true)).toBe("••••");
  });
  it("formats ordinary values", () => {
    expect(changeValueText(null, false)).toBe("—");
    expect(changeValueText(42, false)).toBe("42");
    expect(changeValueText({ a: 1 }, false)).toBe(JSON.stringify({ a: 1 }));
  });
});

describe("External-Principal badge", () => {
  it("marks client and vendor users only", () => {
    expect(externalPrincipalLabel("client_user")).toBe("Client user");
    expect(externalPrincipalLabel("vendor_user")).toBe("Vendor user");
    expect(externalPrincipalLabel("user")).toBeNull();
    expect(externalPrincipalLabel("system")).toBeNull();
  });
  it("names the actor from actor_display or its type", () => {
    expect(actorName("client_user", "Priya (Acme)")).toBe("Priya (Acme)");
    expect(actorName("system", null)).toBe("System");
    expect(actorName("ai", "  ")).toBe("AI assistant");
    expect(actorName("new_kind", null)).toBe("new kind");
  });
});

describe("timeline query and icons", () => {
  it("builds the cursor query", () => {
    expect(timelineQuery("invoice", "abc", null)).toBe("subject_type=invoice&subject_id=abc&limit=25");
    expect(timelineQuery("invoice", "abc", "c2", 10)).toBe("subject_type=invoice&subject_id=abc&limit=10&cursor=c2");
  });
  it("picks the icon family from the action verb", () => {
    expect(actionKind("invoice.created")).toBe("create");
    expect(actionKind("invoice.updated")).toBe("update");
    expect(actionKind("retention.expired")).toBe("delete");
    expect(actionKind("timesheet.approved")).toBe("approve");
    expect(actionKind("document.signed")).toBe("sign");
    expect(actionKind("something")).toBe("other");
  });
});
