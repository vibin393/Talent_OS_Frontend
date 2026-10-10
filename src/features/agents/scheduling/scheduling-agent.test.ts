import { describe, expect, it } from "vitest";
import { renderProposal } from "@/features/agent-proposals/proposal-renderers";
import { historyLabel, isOpen, offsetLabel, slotLabel, STATUS_BADGES, validateCounter, workingHoursErrors } from "./logic";
import { clampInt } from "./scheduling-settings";

describe("slotLabel (timezone rendering on both sides)", () => {
  const start = "2031-01-07T09:30:00Z";
  const end = "2031-01-07T10:30:00Z";
  it("renders the candidate's zone", () => {
    expect(slotLabel(start, end, "Asia/Kolkata")).toBe("Tue 7 Jan, 3:00–4:00 pm");
  });
  it("renders the recruiter's zone", () => {
    expect(slotLabel(start, end, "Europe/London")).toBe("Tue 7 Jan, 9:30–10:30 am");
  });
  it("names both halves across noon", () => {
    expect(slotLabel("2031-01-07T06:00:00Z", "2031-01-07T07:00:00Z", "Asia/Kolkata")).toBe("Tue 7 Jan, 11:30 am–12:30 pm");
  });
});

describe("validateCounter (Suggest up to 3 times)", () => {
  const now = Date.parse("2031-01-01T00:00:00Z");
  it("accepts up to 3 future windows of at least the duration", () => {
    const v = validateCounter(
      [
        { date: "2031-01-07", from: "15:00", to: "17:00" },
        { date: "", from: "", to: "" },
      ],
      "Asia/Kolkata",
      60,
      now,
    );
    expect(v.errors).toEqual([]);
    expect(v.windows).toEqual([{ start: "2031-01-07T09:30:00.000Z", end: "2031-01-07T11:30:00.000Z" }]);
  });
  it("refuses empty, past, short, incomplete and out-of-hours rows", () => {
    expect(validateCounter([{ date: "", from: "", to: "" }], "UTC", 60, now).errors).toEqual(["Suggest at least one time."]);
    expect(validateCounter([{ date: "2030-12-30", from: "10:00", to: "12:00" }], "UTC", 60, now).errors[0]).toMatch(/future/);
    expect(validateCounter([{ date: "2031-01-07", from: "10:00", to: "10:30" }], "UTC", 60, now).errors[0]).toMatch(/at least 60/);
    expect(validateCounter([{ date: "2031-01-07", from: "10:00", to: "" }], "UTC", 60, now).errors[0]).toMatch(/choose a date/);
    expect(validateCounter([{ date: "2031-01-07", from: "06:00", to: "08:00" }], "UTC", 60, now, { start: "08:00", end: "21:00" }).errors[0]).toMatch(/between 08:00 and 21:00/);
  });
  it("allows at most 3", () => {
    const row = { date: "2031-01-07", from: "10:00", to: "12:00" };
    expect(validateCounter([row, row, row, row], "UTC", 60, now).errors).toContain("Suggest up to 3 times.");
  });
});

describe("labels and states", () => {
  it("status badges and open states", () => {
    expect(STATUS_BADGES.counter_proposed.label).toBe("Counter-proposed");
    expect(STATUS_BADGES.handed_off.label).toBe("Handed off");
    expect(isOpen("slots_offered")).toBe(true);
    expect(isOpen("expired")).toBe(false);
    expect(isOpen("booked")).toBe(false);
  });
  it("history labels", () => {
    expect(historyLabel({ kind: "offered", detail: { round: 1 } })).toBe("Slots offered");
    expect(historyLabel({ kind: "conflict", detail: {} })).toBe("Conflict — new options sent");
    expect(historyLabel({ kind: "booked", detail: { human_id: "INT-000012" } })).toBe("Booked INT-000012");
    expect(historyLabel({ kind: "handed_off", detail: {} })).toBe("Handed off to you");
  });
  it("reminder chips and clamps", () => {
    expect(offsetLabel(1440)).toBe("24 h");
    expect(offsetLabel(30)).toBe("30 min");
    expect(clampInt(99, 1, 10)).toBe(10);
  });
});

describe("preferences editor", () => {
  it("flags reversed or malformed intervals", () => {
    expect(workingHoursErrors({ mon: [["09:00", "18:00"]] })).toEqual([]);
    expect(workingHoursErrors({ tue: [["18:00", "09:00"]] })).toEqual(["Tuesday: the end must be after the start."]);
    expect(workingHoursErrors({ wed: [["9", "10:00"]] })).toEqual(["Wednesday: use HH:MM times."]);
  });
});

describe("proposal renderers", () => {
  it("labels a booking despite conflicts", () => {
    const r = renderProposal({
      tool_key: "interviews.book",
      title: "Book the interview",
      preview: { title: "", summary: "Book despite conflicts", fields: [["request_id", "abc"], ["accept_conflicts", "true"]] },
    } as never);
    expect(r.title).toBe("Book the interview");
    expect(r.rows).toEqual([
      { label: "Scheduling request", value: "abc" },
      { label: "Book despite conflicts", value: "Yes - conflicts were found at re-check" },
    ]);
  });
  it("renders cancel and participant changes", () => {
    expect(renderProposal({ tool_key: "interviews.cancel", title: "", preview: { title: "", summary: "x", fields: [] } } as never).title).toBe("Cancel the interview");
    expect(renderProposal({ tool_key: "interviews.change_participants", title: "", preview: { title: "", summary: "x", fields: [] } } as never).title).toBe("Change the interviewers");
  });
});
