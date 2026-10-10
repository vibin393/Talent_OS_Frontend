import { describe, expect, it } from "vitest";
import {
  emptySchedule,
  linkFieldState,
  previewLines,
  type ScheduleValues,
  timeOptions,
  toCreatePayload,
  toReschedulePayload,
  validateSchedule,
} from "./schedule-form";

const NOW = Date.parse("2026-10-01T00:00:00Z");

function values(over: Partial<ScheduleValues> = {}): ScheduleValues {
  return {
    ...emptySchedule("Europe/London", 60, NOW),
    stageId: "stage-1",
    date: "2026-10-06",
    time: "06:00",
    interviewers: [{ id: "u1", name: "Priya" }],
    ...over,
  };
}

describe("schedule dialog validation", () => {
  it("accepts a complete form", () => {
    expect(validateSchedule(values(), { requireStage: true, now: NOW })).toEqual({});
  });

  it("requires stage, interviewer and a sane duration", () => {
    const e = validateSchedule(values({ stageId: null, interviewers: [], duration: 10 }), { requireStage: true, now: NOW });
    expect(e.stageId).toBeTruthy();
    expect(e.interviewers).toBeTruthy();
    expect(e.duration).toBeTruthy();
    expect(validateSchedule(values({ stageId: null }), { requireStage: false, now: NOW }).stageId).toBeUndefined();
  });

  it("flags DST gaps, past times and bad external emails", () => {
    expect(validateSchedule(values({ date: "2026-03-08", time: "02:30", timezone: "America/New_York" }), { requireStage: true, now: 0 }).start).toMatch(
      /does not exist/,
    );
    expect(validateSchedule(values({ date: "2026-09-01" }), { requireStage: true, now: NOW }).start).toMatch(/past/);
    expect(validateSchedule(values({ date: "2026-09-01", allowPast: true }), { requireStage: true, now: NOW }).start).toBeUndefined();
    expect(validateSchedule(values({ externals: ["nope"] }), { requireStage: true, now: NOW }).externals).toMatch(/nope/);
    // An external interviewer alone is enough.
    expect(validateSchedule(values({ interviewers: [], externals: ["a@b.co"] }), { requireStage: true, now: NOW }).interviewers).toBeUndefined();
  });

  it("validates a pasted meeting link only when the input is shown", () => {
    expect(validateSchedule(values({ meetingUrl: "zoom.us/j/1" }), { requireStage: true, now: NOW }).meetingUrl).toBeTruthy();
    expect(
      validateSchedule(values({ meetingUrl: "zoom.us/j/1", createOnlineMeeting: true }), { requireStage: true, organiserConnected: true, now: NOW })
        .meetingUrl,
    ).toBeUndefined();
  });
});

describe("meeting link field toggling", () => {
  it("offers the Teams/Meet switch only to connected organisers", () => {
    expect(linkFieldState("video", false, false)).toEqual({ showSwitch: true, switchEnabled: false, showLinkInput: true, showLocation: false });
    expect(linkFieldState("video", true, true)).toEqual({ showSwitch: true, switchEnabled: true, showLinkInput: false, showLocation: false });
    expect(linkFieldState("video", true, false).showLinkInput).toBe(true);
    expect(linkFieldState("in_person", true, true)).toEqual({ showSwitch: false, switchEnabled: false, showLinkInput: false, showLocation: true });
    expect(linkFieldState("phone", false, false).showLinkInput).toBe(false);
  });
});

describe("payloads", () => {
  it("maps the create payload", () => {
    const p = toCreatePayload(values({ externals: ["Ext@Example.com"], meetingUrl: "https://zoom.us/j/1", createOnlineMeeting: true }), false);
    expect(p).toMatchObject({
      stage_id: "stage-1",
      start_local: "2026-10-06T06:00",
      timezone: "Europe/London",
      duration_minutes: 60,
      create_online_meeting: false,
      meeting_url: "https://zoom.us/j/1",
      send_invites: true,
    });
    expect(p.participants).toEqual([
      { kind: "interviewer_internal", user_id: "u1" },
      { kind: "interviewer_external", email: "ext@example.com" },
    ]);
    const connected = toCreatePayload(values({ createOnlineMeeting: true, meetingUrl: "https://x.y" }), true);
    expect(connected.create_online_meeting).toBe(true);
    expect(connected.meeting_url).toBeNull();
  });

  it("maps the reschedule payload with the expected version", () => {
    const p = toReschedulePayload(values(), false, 3);
    expect(p.expected_version).toBe(3);
    expect(p.start_local).toBe("2026-10-06T06:00");
  });

  it("previews the time per participant zone", () => {
    const lines = previewLines(values({ time: "06:00" }), [
      { label: "Candidate", timezone: "Asia/Kolkata" },
      { label: "Priya", timezone: null },
    ]);
    expect(lines[0]).toMatch(/^Candidate sees: Tue 6 Oct, 10:30 (IST|UTC\+05:30)$/);
    expect(lines[1]).toMatch(/^Priya sees: Tue 6 Oct, 06:00 /);
  });

  it("lists quarter-hour times", () => {
    const t = timeOptions();
    expect(t).toHaveLength(96);
    expect(t[1]).toBe("00:15");
    expect(t[95]).toBe("23:45");
  });
});
