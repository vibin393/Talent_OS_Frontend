import { describe, expect, it } from "vitest";
import { ownerEpicLabel, settingsCategories } from "./catalog";

const e = (category: string, available = true) => ({ key: category, category, label: category, description: "", endpoint: "", available });

describe("settings registry hub", () => {
  it("labels unavailable entries with their owner epic", () => {
    expect(ownerEpicLabel({ available: false, owner_epic: "16" })).toBe("Owner: Epic 16");
    expect(ownerEpicLabel({ available: false, owner_epic: 26 })).toBe("Owner: Epic 26");
    expect(ownerEpicLabel({ available: false, owner_epic: "Epic 22" })).toBe("Owner: Epic 22");
    expect(ownerEpicLabel({ available: true, owner_epic: "16" })).toBeNull();
    expect(ownerEpicLabel({ available: false, owner_epic: null })).toBeNull();
  });
  it("groups by the known categories first, then new registry categories", () => {
    const cats = settingsCategories([e("services"), e("finance"), e("finance"), e("people_ops", false)]);
    expect(cats.map((c) => c.value)).toEqual(["organization", "services", "security_privacy", "finance", "people_ops"]);
    expect(cats.find((c) => c.value === "people_ops")?.label).toBe("People ops");
  });
});
