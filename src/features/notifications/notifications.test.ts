import { describe, expect, it } from "vitest";
import { bellAriaLabel, groupByDay, relativeTime, safeLinkPath, UNREAD_POLL, unreadBadgeText } from "./format";

describe("unread badge", () => {
  it("formats counts and caps at 99+", () => {
    expect(unreadBadgeText(0)).toBe("");
    expect(unreadBadgeText(7)).toBe("7");
    expect(unreadBadgeText(99)).toBe("99");
    expect(unreadBadgeText(100)).toBe("99+");
    expect(unreadBadgeText(150)).toBe("99+");
    expect(bellAriaLabel(150)).toBe("Notifications, 99+ unread");
    expect(bellAriaLabel(0)).toBe("Notifications, no unread");
  });

  it("polls at most every 30 s, on focus, never in the background", () => {
    expect(UNREAD_POLL.refetchInterval).toBeLessThanOrEqual(30_000);
    expect(UNREAD_POLL.refetchIntervalInBackground).toBe(false);
    expect(UNREAD_POLL.refetchOnWindowFocus).toBe(true);
  });
});

describe("flyout helpers", () => {
  const now = new Date(2026, 8, 30, 15, 0);
  const at = (d: Date) => ({ created_at: d.toISOString() });

  it("groups Today / Yesterday / Earlier in order", () => {
    const groups = groupByDay(
      [at(new Date(2026, 8, 30, 9)), at(new Date(2026, 8, 29, 23)), at(new Date(2026, 8, 20)), at(new Date(2026, 8, 30, 1))],
      now,
    );
    expect(groups.map((g) => [g.group, g.items.length])).toEqual([
      ["Today", 2],
      ["Yesterday", 1],
      ["Earlier", 1],
    ]);
  });

  it("formats relative times", () => {
    expect(relativeTime(new Date(2026, 8, 30, 14, 59, 40).toISOString(), now)).toBe("Just now");
    expect(relativeTime(new Date(2026, 8, 30, 14, 30).toISOString(), now)).toBe("30m ago");
    expect(relativeTime(new Date(2026, 8, 30, 12, 0).toISOString(), now)).toBe("3h ago");
    expect(relativeTime(new Date(2026, 8, 28, 15, 0).toISOString(), now)).toBe("2d ago");
  });

  it("only follows app-relative links", () => {
    expect(safeLinkPath("/demands/1")).toBe("/demands/1");
    expect(safeLinkPath("https://evil.example")).toBeNull();
    expect(safeLinkPath("//evil.example")).toBeNull();
    expect(safeLinkPath(null)).toBeNull();
  });
});
