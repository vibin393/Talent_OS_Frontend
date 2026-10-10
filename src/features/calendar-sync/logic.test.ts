import { describe, expect, it } from "vitest";
import type { InterviewSync } from "./api";
import { banners, responseLabel, syncStatusText } from "./logic";

const base: InterviewSync = { interview_id: "i", move_policy: "restore", participants: [], links: [] };
const link = (state: InterviewSync["links"][number]["state"]) => ({
  id: "l",
  role: "organizer" as const,
  participant_id: null,
  state,
  seen_start: "2026-10-20T10:00:00Z",
  seen_end: null,
  organizer_name: "Ada",
});

describe("calendar sync logic", () => {
  it("maps responses incl. tentative", () => {
    expect(responseLabel("tentative")).toBe("Tentative");
    expect(responseLabel("needs_action")).toBe("No response");
    expect(responseLabel(undefined)).toBe("No response");
  });

  it("chooses banners by link state and policy", () => {
    expect(banners({ ...base, links: [link("moved")] }, "2026-10-19T10:00:00Z")[0].kind).toBe("moved_restored");
    expect(banners({ ...base, move_policy: "keep_as_proposal", links: [link("moved")] }, "2026-10-19T10:00:00Z")[0].kind).toBe(
      "moved_proposal",
    );
    expect(banners({ ...base, links: [link("deleted")] }, "x")[0].text).toContain("removed from Ada's calendar");
    expect(banners({ ...base, links: [link("conflict")] }, "x")[0].kind).toBe("conflict");
    expect(banners({ ...base, links: [link("in_sync")] }, "x")).toHaveLength(0);
    const ns = banners({ ...base, participants: [{ participant_id: null, user_id: "u", name: "Bo", state: "not_syncing" }] }, "x");
    expect(ns[0].text).toBe("Calendar not syncing for Bo. Changes they make in their calendar won't reach Talent OS.");
  });

  it("status text", () => {
    expect(syncStatusText(false, undefined).text).toBe("Off for your organisation");
    const ch = { connection_id: "c", provider: "google", status: "polling" as const, last_notification_at: null, last_sync_at: null, poll_minutes: 15 };
    expect(syncStatusText(true, ch).text).toBe("Checking every 15 minutes");
    expect(syncStatusText(true, { ...ch, status: "stopped" }).tone).toBe("danger");
  });
});
