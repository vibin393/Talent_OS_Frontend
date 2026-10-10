import { describe, expect, it } from "vitest";
import {
  blockedMessage,
  boardTagFromSearch,
  packText,
  preselectBoards,
  REGENERATE_CONFIRM,
  rowActions,
  salaryText,
  statusBadge,
} from "./logic";
import type { BoardPostingOut } from "./types";

const row = (over: Partial<BoardPostingOut>): BoardPostingOut => ({
  id: "1",
  human_id: "BP-000001",
  demand_id: "d",
  posting_id: "p",
  installation_id: "i",
  board_key: "naukri",
  board_label: "Naukri",
  status: "live",
  revision: 1,
  local_revision: 1,
  out_of_date: false,
  board_ref: "FJB-1",
  board_url: null,
  expires_at: null,
  views: null,
  applies_reported: null,
  blocked_fields: [],
  last_status_at: null,
  last_error_code: null,
  last_error_message: null,
  manual: false,
  published_by: null,
  published_at: null,
  closed_at: null,
  close_reason: null,
  cost_note: null,
  ...over,
});

describe("job boards logic", () => {
  it("preselects the default set for the employment type", () => {
    const sets = [
      { id: "1", name: "Perm", employment_type: "permanent", board_keys: ["naukri", "linkedin"], is_default: true },
      { id: "2", name: "Any", employment_type: null, board_keys: ["indeed"], is_default: true },
    ];
    expect(preselectBoards(["naukri", "indeed"], sets, "permanent")).toEqual(["naukri"]);
    expect(preselectBoards(["naukri", "indeed"], sets, "contract")).toEqual(["indeed"]);
    expect(preselectBoards(["naukri"], [], null)).toEqual(["naukri"]);
  });

  it("renders blocked boards and hidden salary", () => {
    expect(blockedMessage(["Job category"])).toBe("This board is skipped until you fill: Job category");
    expect(blockedMessage([])).toBeNull();
    expect(salaryText(null)).toBe("Hidden");
  });

  it("maps statuses to badges", () => {
    expect(statusBadge("rejected").label).toBe("Rejected by board");
    expect(statusBadge("live").color).toBe("success");
  });

  it("offers row actions by status", () => {
    expect(rowActions(row({}))).toEqual(["Refresh", "Close"]);
    expect(rowActions(row({ status: "failed" }))).toContain("Copy posting pack");
    expect(rowActions(row({ manual: true }))).toContain("Mark closed");
  });

  it("reads the board tag, builds the pack text and the regenerate confirmation", () => {
    expect(boardTagFromSearch("?src=naukri&bp=abc")).toEqual({ src: "naukri", ref: "abc" });
    expect(boardTagFromSearch("?src=<x>")).toEqual({});
    expect(
      packText({ title: "T", description_text: "D", fields: [{ label: "Location", value: "Pune" }], apply_url: "u" }),
    ).toContain("Location: Pune");
    expect(REGENERATE_CONFIRM).toBe("Boards using the old URL will stop receiving jobs.");
  });
});
