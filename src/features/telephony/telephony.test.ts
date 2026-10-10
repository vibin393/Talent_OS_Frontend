import { describe, expect, it } from "vitest";
import { isTerminal, mmss, offersManualFallback, recordingBadge, recordingLine, refusalTooltip, settingsErrors, statusText, transcriptLine, validOtp } from "./logic";

describe("telephony logic (Epic 76)", () => {
  it("explains every disabled Call state", () => {
    expect(refusalTooltip("call_phone_not_verified")).toBe("Add and verify your calling phone first");
    expect(refusalTooltip("voice_consent_required")).toBe("Waiting for the candidate's consent");
    expect(refusalTooltip("do_not_call")).toBe("Do not call — the candidate asked not to be called");
    expect(refusalTooltip("cost_cap_reached")).toBe("Today's calling budget is used up");
    expect(refusalTooltip("no_voice_provider")).toBe("No calling provider set up — call outside Talent OS");
    expect(refusalTooltip("ecosystem_suspended")).toBe("External access is paused by your admin");
    expect(refusalTooltip("outside_calling_hours", null)).toBe("Outside the candidate's calling hours");
    expect(refusalTooltip("outside_calling_hours", "2026-10-13T09:00:00+05:30")).toMatch(/^Outside the candidate's calling hours \(next: .+\)$/);
    expect(refusalTooltip(null)).toBeNull();
    expect(offersManualFallback("cost_cap_reached")).toBe(true);
    expect(offersManualFallback("do_not_call")).toBe(false);
  });

  it("shows the recording badge variants", () => {
    expect(recordingBadge({ recording_will_be: "recorded", recording_reason: null })).toBe("Recorded");
    expect(recordingBadge({ recording_will_be: "not_recorded", recording_reason: "policy_not_permitted" })).toBe(
      "Not recorded — recording isn't allowed in the candidate's location",
    );
    expect(recordingBadge({ recording_will_be: "not_recorded", recording_reason: "consent_missing" })).toBe("Not recorded — the candidate didn't consent to recording");
    expect(recordingBadge({ recording_will_be: "not_recorded", recording_reason: "notice_unavailable" })).toBe(
      "Not recorded — recording notice isn't set up for this provider",
    );
  });

  it("walks the live panel through the call states", () => {
    expect(statusText({ status: "dialing_recruiter", duration_s: null }, "Priya")).toBe("Ringing your phone…");
    expect(statusText({ status: "dialing_candidate", duration_s: null }, "Priya")).toBe("Connecting Priya…");
    expect(statusText({ status: "in_progress", duration_s: null }, "Priya", 65)).toBe("In call · 01:05");
    expect(statusText({ status: "completed", duration_s: 75 }, "Priya")).toBe("Call ended · 01:15");
    expect(statusText({ status: "no_answer", duration_s: null }, "Priya")).toBe("No answer");
    expect(statusText({ status: "busy", duration_s: null }, "Priya")).toBe("Busy");
    expect(statusText({ status: "failed", duration_s: null }, "Priya")).toBe("Call failed");
    expect(isTerminal("in_progress")).toBe(false);
    expect(isTerminal("completed")).toBe(true);
    expect(mmss(0)).toBe("00:00");
    expect(recordingLine({ recorded: true, recording_status: "stored" })).toBe("Recording: saved");
    expect(recordingLine({ recorded: true, recording_status: "pending" })).toBe("Recording: processing");
    expect(recordingLine({ recorded: false, recording_status: "none" })).toBe("Recording: not recorded");
    expect(transcriptLine({ transcript_status: "running" })).toBe("Transcript: transcribing");
    expect(transcriptLine({ transcript_status: "completed" })).toBe("Transcript: ready");
    expect(transcriptLine({ transcript_status: "failed" })).toBe("Transcript: not available — Upload transcript");
  });

  it("validates the phone code and the settings form", () => {
    expect(validOtp("123456")).toBe(true);
    expect(validOtp("12345a")).toBe(false);
    expect(settingsErrors({ call_window_start: "09:00", call_window_end: "21:00", daily_cost_cap_minor: 0, cost_alert_pct: 80 })).toEqual({});
    const bad = settingsErrors({ call_window_start: "21:00:00", call_window_end: "09:00:00", daily_cost_cap_minor: -1, cost_alert_pct: 40 });
    expect(Object.keys(bad).sort()).toEqual(["call_window_end", "cost_alert_pct", "daily_cost_cap_minor"]);
  });
});
