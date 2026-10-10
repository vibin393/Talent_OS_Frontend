import { describe, expect, it } from "vitest";
import { canToggleSensitive, statusBadge, tabFilter, transformLabel } from "./logic";

describe("hrms-sync logic", () => {
  it("maps record status to a badge", () => {
    expect(statusBadge("synced")).toEqual({ label: "Synced", color: "success" });
    expect(statusBadge("blocked")).toEqual({ label: "Blocked", color: "warning" });
    expect(statusBadge("failed")).toEqual({ label: "Failed", color: "danger" });
    expect(statusBadge("skipped").color).toBe("subtle");
    expect(statusBadge("weird")).toEqual({ label: "weird", color: "informative" });
  });

  it("gates the sensitive switch on ledger:sync (Finance)", () => {
    expect(canToggleSensitive(true)).toBe(true);
    expect(canToggleSensitive(false)).toBe(false);
  });

  it("maps queue tabs to record filters", () => {
    expect(tabFilter("pending")).toEqual({ status: "pending" });
    expect(tabFilter("mismatch")).toEqual({ mismatch: true });
  });

  it("labels transforms", () => {
    expect(transformLabel("date_dmy")).toBe("Date (DD-MM-YYYY)");
    expect(transformLabel("none")).toBe("None");
  });
});
