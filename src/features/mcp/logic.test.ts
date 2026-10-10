import { describe, expect, it } from "vitest";
import {
  canEnable,
  endReasonLabel,
  executionBadge,
  limitErrors,
  LOW_TOOLS,
  myAssistantsState,
  MY_ASSISTANTS_TEXT,
  originError,
  STATUS_LABELS,
  tierHint,
} from "./logic";

describe("low-tool modes", () => {
  it("lists only the four creating tools", () => {
    expect(LOW_TOOLS.map((t) => t.key)).toEqual(["notes.add", "tasks.create", "demands.create_draft", "messaging.create_draft"]);
    expect(LOW_TOOLS.map((t) => t.label)).toEqual(["Add notes", "Create tasks", "Draft demands", "Draft messages"]);
  });
  it("labels execution classes", () => {
    expect(executionBadge("read")).toBe("Reads");
    expect(executionBadge("propose")).toBe("Proposes");
    expect(executionBadge("draft")).toBe("Creates (needs approval)");
    expect(executionBadge("draft", "auto")).toBe("Creates (runs at once)");
  });
});

describe("limits form", () => {
  const ok = { calls_per_minute: 60, calls_per_user_day: 2000, proposals_per_hour: 25, bulk_read_threshold: 500, max_results: 50 };
  it("caps calls per minute at the tier", () => {
    expect(limitErrors(ok, 60)).toEqual({});
    expect(limitErrors({ ...ok, calls_per_minute: 61 }, 60).calls_per_minute).toBeDefined();
    expect(limitErrors({ ...ok, calls_per_minute: 30 }, 30)).toEqual({});
    expect(tierHint(60)).toBe("Your plan allows up to 60");
  });
  it("checks every range", () => {
    const bad = limitErrors({ calls_per_minute: 4, calls_per_user_day: 99, proposals_per_hour: 26, bulk_read_threshold: 49, max_results: 51 }, 120);
    expect(Object.keys(bad).sort()).toEqual(["bulk_read_threshold", "calls_per_minute", "calls_per_user_day", "max_results", "proposals_per_hour"]);
  });
  it("accepts https origins only", () => {
    expect(originError("https://assistant.example", [])).toBeNull();
    expect(originError("http://assistant.example", [])).not.toBeNull();
    expect(originError("https://a.example", Array.from({ length: 10 }, (_, i) => `https://x${i}.example`))).toBe("You can list up to 10 origins.");
  });
});

describe("enable dialog", () => {
  it("needs the acknowledgement, a group and AI agents", () => {
    expect(canEnable(false, ["core"], true)).toBe(false);
    expect(canEnable(true, [], true)).toBe(false);
    expect(canEnable(true, ["core"], false)).toBe(false);
    expect(canEnable(true, ["core"], true)).toBe(true);
  });
});

describe("sessions grid", () => {
  it("labels statuses and end reasons", () => {
    expect(STATUS_LABELS.active).toEqual({ label: "Active", color: "success" });
    expect(STATUS_LABELS.paused.label).toBe("Paused");
    expect(STATUS_LABELS.ended.color).toBe("subtle");
    expect(endReasonLabel("bulk_read")).toBe("Read an unusual number of candidate records");
    expect(endReasonLabel(null)).toBe("");
  });
});

describe("my assistants", () => {
  const base = { enabled: true, has_permission: true, on_hold: false, server_url: "https://app.example/mcp" };
  it("derives the page state", () => {
    expect(myAssistantsState(undefined)).toBeNull();
    expect(myAssistantsState({ ...base, enabled: false })).toBe("disabled");
    expect(myAssistantsState({ ...base, has_permission: false })).toBe("no_permission");
    expect(myAssistantsState({ ...base, on_hold: true })).toBe("on_hold");
    expect(myAssistantsState(base)).toBe("ready");
    expect(MY_ASSISTANTS_TEXT.disabled).toBe("Your organisation hasn't turned on AI assistant access.");
  });
});
