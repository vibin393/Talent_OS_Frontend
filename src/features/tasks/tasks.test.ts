import { describe, expect, it } from "vitest";
import type { TaskOut } from "@/lib/api/types";
import {
  dueLabel,
  entityHref,
  isOverdue,
  isSmartList,
  localDateKey,
  quickAddDue,
  taskListQuery,
  withStatus,
  zonedInstant,
} from "./task-model";

const task = (patch: Partial<TaskOut>): TaskOut =>
  ({
    id: "t1",
    title: "Call client",
    notes: null,
    owner_id: "u1",
    owner_name: "Priya",
    created_by: "u1",
    created_by_name: "Priya",
    entity_type: null,
    entity_id: null,
    due_at: null,
    due_all_day: false,
    priority: "normal",
    reminder_at: null,
    reminded_at: null,
    status: "open",
    completed_at: null,
    completed_by: null,
    source: "manual",
    workflow_execution_id: null,
    is_overdue: false,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...patch,
  }) as TaskOut;

describe("overdue across time zones", () => {
  // An all-day task due 29 Sep, stored as local noon in Kolkata (06:30 UTC).
  const allDay = task({ due_at: zonedInstant("2026-09-29", "12:00", "Asia/Kolkata").toISOString(), due_all_day: true });
  const now = new Date("2026-09-29T19:00:00Z"); // 30 Sep 00:30 in Kolkata, still 29 Sep in UTC.

  it("stores all-day dates as local noon", () => {
    expect(allDay.due_at).toBe("2026-09-29T06:30:00.000Z");
  });

  it("an all-day task is overdue only after its date ends in the owner's zone", () => {
    expect(isOverdue(allDay, now, "Asia/Kolkata")).toBe(true);
    expect(isOverdue(allDay, now, "UTC")).toBe(false);
    expect(isOverdue(allDay, new Date("2026-09-29T17:00:00Z"), "Asia/Kolkata")).toBe(false); // 22:30 on the day
  });

  it("a timed task is overdue once its time passed; done tasks never are", () => {
    const timed = task({ due_at: "2026-09-29T10:00:00Z" });
    expect(isOverdue(timed, new Date("2026-09-29T09:59:00Z"), "UTC")).toBe(false);
    expect(isOverdue(timed, new Date("2026-09-29T10:01:00Z"), "America/Los_Angeles")).toBe(true);
    expect(isOverdue({ ...timed, status: "done" }, new Date("2026-10-10T00:00:00Z"), "UTC")).toBe(false);
    expect(isOverdue(task({}), now, "UTC")).toBe(false);
  });

  it("recomputes overdue when completed or reopened", () => {
    const late = task({ due_at: "2026-09-01T10:00:00Z", is_overdue: true });
    const done = withStatus(late, true, now, "UTC");
    expect(done.status).toBe("done");
    expect(done.is_overdue).toBe(false);
    expect(withStatus(done, false, now, "UTC").is_overdue).toBe(true);
  });

  it("labels due dates relative to the local day", () => {
    expect(dueLabel(allDay, now, "Asia/Kolkata", "en-GB")).toBe("Yesterday");
    expect(dueLabel(allDay, now, "UTC", "en-GB")).toBe("Today");
    expect(dueLabel(task({}), now, "UTC")).toBe("");
  });

  it("handles DST when converting wall-clock times", () => {
    expect(zonedInstant("2026-03-08", "12:00", "America/New_York").toISOString()).toBe("2026-03-08T16:00:00.000Z");
    expect(zonedInstant("2026-01-15", "12:00", "America/New_York").toISOString()).toBe("2026-01-15T17:00:00.000Z");
    expect(localDateKey(new Date("2026-09-29T19:00:00Z"), "Asia/Kolkata")).toBe("2026-09-30");
  });
});

describe("quick add", () => {
  const now = new Date("2026-09-29T19:00:00Z");

  it("adds to today in My Day (owner's today), tomorrow in Upcoming, undated in No date", () => {
    expect(quickAddDue("my_day", now, "Asia/Kolkata")).toEqual({ due_at: "2026-09-30T06:30:00.000Z", due_all_day: true });
    expect(quickAddDue("upcoming", now, "UTC")).toEqual({ due_at: "2026-09-30T12:00:00.000Z", due_all_day: true });
    expect(quickAddDue("no_date", now, "UTC")).toEqual({ due_at: null, due_all_day: false });
  });

  it("maps smart lists to the list query", () => {
    expect(taskListQuery("my_day")).toContain("owner=me");
    expect(taskListQuery("my_day")).toContain("view=today");
    expect(taskListQuery("assigned_by_me")).toContain("created_by=me");
    expect(taskListQuery("assigned_by_me")).not.toContain("view=");
    expect(taskListQuery("overdue", { q: " call " })).toContain("q=call");
    expect(isSmartList("overdue")).toBe(true);
    expect(isSmartList("nope")).toBe(false);
  });

  it("links entity chips to their pages", () => {
    expect(entityHref("demand", "d1")).toBe("/demands/d1");
    expect(entityHref("application", "a1")).toBeNull();
    expect(entityHref(null, null)).toBeNull();
  });
});
