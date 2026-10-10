import { describe, expect, it } from "vitest";
import { authorLabel, formatWhen, fromLocalInputValue, participantsLabel, toLocalInputValue } from "./format";

describe("datetime-local conversion", () => {
  it("formats in local time and parses back", () => {
    const d = new Date(2026, 8, 30, 9, 5, 42);
    expect(toLocalInputValue(d)).toBe("2026-09-30T09:05");
    expect(fromLocalInputValue("2026-09-30T09:05")).toBe(new Date(2026, 8, 30, 9, 5).toISOString());
  });

  it("returns null for empty or invalid values", () => {
    expect(fromLocalInputValue("")).toBeNull();
    expect(fromLocalInputValue("not a date")).toBeNull();
  });
});

describe("formatWhen", () => {
  const now = new Date("2026-09-30T12:00:00Z");
  it("uses relative labels for the last day", () => {
    expect(formatWhen("2026-09-30T11:59:30Z", now)).toBe("Just now");
    expect(formatWhen("2026-09-30T11:45:00Z", now)).toBe("15 min ago");
    expect(formatWhen("2026-09-30T07:00:00Z", now)).toBe("5 h ago");
  });
  it("falls back to a date for older or future entries and blanks invalid input", () => {
    expect(formatWhen("2026-09-20T12:00:00Z", now)).not.toMatch(/ago|now/);
    expect(formatWhen("2026-10-01T12:00:00Z", now)).not.toMatch(/ago|now/);
    expect(formatWhen("garbage", now)).toBe("");
  });
});

describe("authorLabel / participantsLabel", () => {
  it("labels authors", () => {
    expect(authorLabel({ author_id: "u1", author_name: "Ann", kind: "note" }, "u1")).toBe("You");
    expect(authorLabel({ author_id: "u2", author_name: "Ann", kind: "note" }, "u1")).toBe("Ann");
    expect(authorLabel({ author_id: null, author_name: null, kind: "system" })).toBe("System");
    expect(authorLabel({ author_id: "x", author_name: null, kind: "call" })).toBe("Unknown user");
  });
  it("joins named participants", () => {
    expect(
      participantsLabel([
        { kind: "contact", id: null, name: "Ann" },
        { kind: "other", id: null, name: " " },
        { kind: "user", id: null, name: "Bob" },
      ]),
    ).toBe("Ann, Bob");
  });
});
