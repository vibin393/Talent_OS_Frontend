import { describe, expect, it } from "vitest";
import { boardName, boardView, currentEntry, eventActions, formatEta, parseCheckinToken, waitText } from "./logic";
import { applyPoll, fetchWithEtag, pollOnce, type PollState } from "./poll";
import type { QueueEntryOut } from "./types";

describe("ETA formatting", () => {
  it("formats minutes as human text", () => {
    expect(formatEta(null)).toBe("—");
    expect(formatEta(-3)).toBe("—");
    expect(formatEta(0)).toBe("Now");
    expect(formatEta(4.6)).toBe("About 5 min");
    expect(formatEta(60)).toBe("About 1 h");
    expect(formatEta(70)).toBe("About 1 h 10 min");
  });
  it("combines position and ETA", () => {
    expect(waitText({ ahead: 0, eta_minutes: 3 })).toBe("Next · About 3 min");
    expect(waitText({ ahead: 4, eta_minutes: 25 })).toBe("4 ahead · About 25 min");
  });
});

type FakeRes = { status: number; ok: boolean; headers: { get: (k: string) => string | null }; text: () => Promise<string> };
function res(status: number, body: unknown, etag: string | null): FakeRes {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k: string) => (k.toLowerCase() === "etag" ? etag : null) },
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  };
}

describe("poll hook ETag behaviour", () => {
  it("sends If-None-Match and keeps the previous data on 304", async () => {
    const calls: (Record<string, string> | undefined)[] = [];
    const responses = [res(200, { n: 1 }, '"v1"'), res(304, undefined, '"v1"'), res(200, { n: 2 }, '"v2"')];
    const fake = async (_: string, init?: RequestInit) => {
      calls.push(init?.headers as Record<string, string>);
      return responses.shift() as unknown as Response;
    };
    let state: PollState<{ n: number }> = { data: undefined, etag: null };
    state = await pollOnce(state, "/api/v1/campus/events/e/queue", fake);
    expect(state).toEqual({ data: { n: 1 }, etag: '"v1"' });
    expect(calls[0]?.["If-None-Match"]).toBeUndefined();
    state = await pollOnce(state, "/api/v1/campus/events/e/queue", fake);
    expect(calls[1]?.["If-None-Match"]).toBe('"v1"');
    expect(state).toEqual({ data: { n: 1 }, etag: '"v1"' });
    state = await pollOnce(state, "/api/v1/campus/events/e/queue", fake);
    expect(state).toEqual({ data: { n: 2 }, etag: '"v2"' });
  });

  it("does not send an ETag when no data is held", async () => {
    let sent: string | undefined;
    const fake = async (_: string, init?: RequestInit) => {
      sent = (init?.headers as Record<string, string>)["If-None-Match"];
      return res(200, { ok: true }, '"x"') as unknown as Response;
    };
    await pollOnce({ data: undefined, etag: '"stale"' }, "/api/v1/x", fake);
    expect(sent).toBeUndefined();
  });

  it("raises API errors and keeps 304 pure", async () => {
    const fake = async () => res(403, { error: { code: "forbidden", message: "No" } }, null) as unknown as Response;
    await expect(fetchWithEtag("/api/v1/x", null, fake)).rejects.toMatchObject({ status: 403, code: "forbidden" });
    expect(applyPoll({ data: [1], etag: '"a"' }, { status: "not_modified", etag: null })).toEqual({ data: [1], etag: '"a"' });
  });
});

function entry(id: string, status: QueueEntryOut["status"], position: number, station: string | null = null): QueueEntryOut {
  return {
    id,
    position,
    candidate_id: `c${id}`,
    candidate_name: "Asha Kumari Rao",
    demand_id: null,
    demand_title: null,
    status,
    station_id: station,
    station_label: station,
    application_id: null,
    interview_id: null,
    called_at: null,
    started_at: null,
    completed_at: null,
    notified_at: null,
    notify_result: null,
  };
}

describe("queue views", () => {
  const q = { entries: [entry("3", "waiting", 3), entry("1", "called", 1, "s1"), entry("2", "waiting", 2), entry("4", "in_interview", 0, "s2")] };
  it("splits the board", () => {
    const b = boardView(q);
    expect(b.calling.map((e) => e.id)).toEqual(["1"]);
    expect(b.waiting.map((e) => e.id)).toEqual(["2", "3"]);
    expect(b.inInterview.map((e) => e.id)).toEqual(["4"]);
  });
  it("finds a station's current entry", () => {
    expect(currentEntry(q, { id: "s2", current_entry_id: null })?.id).toBe("4");
    expect(currentEntry(q, { id: "s9", current_entry_id: null })).toBeNull();
  });
  it("shortens names for the hall screen", () => {
    expect(boardName("Asha Kumari Rao")).toBe("Asha R.");
    expect(boardName(null)).toBe("Candidate");
  });
  it("parses check-in tokens from URLs and raw codes", () => {
    const t = "a".repeat(32);
    expect(parseCheckinToken(`https://x.test/campus/e/${t}`)).toBe(t);
    expect(parseCheckinToken(`https://x.test/l/${t}?utm=1`)).toBe(t);
    expect(parseCheckinToken(`https://x.test/c?token=${t}`)).toBe(t);
    expect(parseCheckinToken(` ${t} `)).toBe(t);
    expect(parseCheckinToken("short")).toBeNull();
  });
  it("offers lifecycle actions by status", () => {
    expect(eventActions("draft")).toEqual(["open", "cancel"]);
    expect(eventActions("live")).toEqual(["close"]);
    expect(eventActions("closed")).toEqual([]);
  });
});
