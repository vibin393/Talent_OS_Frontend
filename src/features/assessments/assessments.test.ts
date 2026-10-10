import { describe, expect, it } from "vitest";
import {
  AutosaveQueue,
  canDecide,
  dueWarning,
  emptyItemForm,
  findForbiddenKeys,
  type ForbiddenDeliveryKey,
  itemFormErrors,
  parseBlankMarkers,
  remainingSeconds,
  sectionErrors,
  newSection,
  SignalBatcher,
  syncClock,
  toDraft,
  toItemBody,
} from "./logic";
import type { AttemptView, DeliveryItem, PreStartOut } from "./types";

// ---------------------------------------------------------------- compile-time: delivery types carry no key fields

type DeepKeys<T> = T extends readonly (infer U)[] ? DeepKeys<U> : T extends object ? { [K in keyof T]-?: K | DeepKeys<T[K]> }[keyof T] : never;
type Leaks<T> = Extract<DeepKeys<T>, ForbiddenDeliveryKey>;
// Each line fails to compile if a forbidden key is ever added to a candidate-facing type.
const noLeakDelivery: [Leaks<DeliveryItem>] extends [never] ? true : false = true;
const noLeakAttempt: [Leaks<Omit<AttemptView, "answers">>] extends [never] ? true : false = true;
const noLeakPreStart: [Leaks<PreStartOut>] extends [never] ? true : false = true;

describe("delivery types have no key fields", () => {
  it("compile-time checks hold", () => {
    expect([noLeakDelivery, noLeakAttempt, noLeakPreStart]).toEqual([true, true, true]);
  });

  it("a sample attempt view conforming to the types has no forbidden keys", () => {
    const item: DeliveryItem = {
      position: 1,
      section_key: "s1",
      kind: "code_order",
      stem: "Order the lines",
      options: null,
      code: null,
      language: "python",
      lines: [
        { id: "x", text: "print(1)" },
        { id: "y", text: "x = 1" },
      ],
      blanks: null,
      points: "2",
    };
    const view: Omit<AttemptView, "answers"> = {
      session_id: "sess",
      server_now: "2026-10-06T10:00:00Z",
      deadline_at: "2026-10-06T11:00:00Z",
      remaining_seconds: 3600,
      status: "in_progress",
      current_section: "s1",
      screen_reader_mode: false,
      sections: [{ key: "s1", title: "One", deadline_at: null, closed: false, positions: [1] }],
      items: [item],
    };
    expect(findForbiddenKeys(view)).toEqual([]);
  });

  it("findForbiddenKeys catches nested leaks", () => {
    expect(findForbiddenKeys({ items: [{ answer_key: { correct: "a" }, options: [{ id: "a" }] }], x: { rubric: null } })).toEqual([
      "items[0].answer_key",
      "x.rubric",
    ]);
  });
});

// ---------------------------------------------------------------- timer re-sync

describe("server-synced timer", () => {
  it("uses the server clock, so client skew cancels out", () => {
    const server = Date.parse("2026-10-06T10:00:00Z");
    const deadline = "2026-10-06T10:30:00Z";
    // Client clock is 7 minutes fast.
    const skewedClient = server + 7 * 60_000;
    const sync = syncClock(new Date(server).toISOString(), deadline, skewedClient);
    expect(remainingSeconds(sync, skewedClient)).toBe(1800);
    // 90 s later on the client clock.
    expect(remainingSeconds(sync, skewedClient + 90_000)).toBe(1710);
  });

  it("re-syncs from a later autosave response and never goes negative", () => {
    const t0 = 1_000_000;
    let sync = syncClock(new Date(t0).toISOString(), new Date(t0 + 60_000).toISOString(), t0 - 5_000);
    expect(remainingSeconds(sync, t0 - 5_000)).toBe(60);
    // The server extended the deadline (accommodation) and its clock moved on 10 s.
    sync = syncClock(new Date(t0 + 10_000).toISOString(), new Date(t0 + 120_000).toISOString(), t0 + 6_000);
    expect(remainingSeconds(sync, t0 + 6_000)).toBe(110);
    expect(remainingSeconds(sync, t0 + 500_000)).toBe(0);
  });

  it("announces the 5- and 1-minute warnings once each", () => {
    const announced = new Set<number>();
    expect(dueWarning(301, announced)).toBeNull();
    expect(dueWarning(300, announced)).toBe("5 minutes remaining");
    expect(dueWarning(299, announced)).toBeNull();
    expect(dueWarning(60, announced)).toBe("1 minute remaining");
    expect(dueWarning(30, announced)).toBeNull();
  });

  it("a late resync past both thresholds announces only once", () => {
    const announced = new Set<number>();
    expect(dueWarning(45, announced)).toBe("1 minute remaining");
    expect(dueWarning(200, announced)).toBeNull();
  });
});

// ---------------------------------------------------------------- autosave queue

describe("autosave queue", () => {
  it("coalesces changes per position and assigns monotonic client_seq", () => {
    const q = new AutosaveQueue();
    q.set(1, { choice: "a" });
    q.set(1, { choice: "b" });
    q.set(2, { text: "x" });
    const b1 = q.take();
    expect(b1).toEqual({ client_seq: 1, answers: [{ position: 1, response: { choice: "b" } }, { position: 2, response: { text: "x" } }] });
    // One batch in flight at a time.
    q.set(3, { value: "1" });
    expect(q.take()).toBeNull();
    expect(q.ack(1)).toBe(true);
    const b2 = q.take();
    expect(b2?.client_seq).toBe(2);
  });

  it("drops stale acknowledgements", () => {
    const q = new AutosaveQueue();
    q.set(1, { text: "a" });
    q.take();
    expect(q.ack(1)).toBe(true);
    q.set(1, { text: "b" });
    q.take();
    expect(q.ack(2)).toBe(true);
    expect(q.ack(1)).toBe(false);
    expect(q.ack(2)).toBe(false);
  });

  it("re-queues a failed batch without overwriting newer edits, and retries with a new seq", () => {
    const q = new AutosaveQueue();
    q.set(1, { text: "old" });
    q.set(2, { text: "keep" });
    const b = q.take();
    q.set(1, { text: "new" });
    q.fail(b!.client_seq);
    const retry = q.take();
    expect(retry?.client_seq).toBe(2);
    expect(retry?.answers).toEqual([
      { position: 1, response: { text: "new" } },
      { position: 2, response: { text: "keep" } },
    ]);
  });
});

// ---------------------------------------------------------------- signal batching

describe("signal batching", () => {
  it("collapses repeats within the dedupe window and drains in batches", () => {
    const b = new SignalBatcher(2, 500, 10);
    expect(b.push("focus_loss", 1000)).toBe(true);
    expect(b.push("focus_loss", 1200)).toBe(false);
    expect(b.push("tab_switch", 1200)).toBe(true);
    expect(b.push("focus_loss", 1600)).toBe(true);
    expect(b.size).toBe(3);
    const first = b.drain();
    expect(first.map((s) => s.kind)).toEqual(["focus_loss", "tab_switch"]);
    expect(first[0].client_ts).toBe(new Date(1000).toISOString());
    expect(b.drain().map((s) => s.kind)).toEqual(["focus_loss"]);
    expect(b.size).toBe(0);
  });

  it("requeues a failed batch at the front and caps the buffer", () => {
    const b = new SignalBatcher(50, 0, 3);
    b.push("copy", 1);
    b.push("paste", 2);
    const sent = b.drain();
    b.push("tab_switch", 3);
    b.requeue(sent);
    expect(b.drain().map((s) => s.kind)).toEqual(["copy", "paste", "tab_switch"]);
    for (let i = 0; i < 10; i++) b.push("copy", 100 + i);
    expect(b.size).toBe(3);
  });
});

// ---------------------------------------------------------------- ★ Pass/Fail visibility

describe("★ Pass/Fail buttons", () => {
  it("are hidden without assessment:review", () => {
    expect(canDecide({ status: "reviewed" }, { "assessment:read": "tenant" })).toBe(false);
    expect(canDecide({ status: "reviewed" }, null)).toBe(false);
  });

  it("show for reviewers only once the attempt is reviewed", () => {
    const perms = { "assessment:review": "tenant" };
    expect(canDecide({ status: "reviewed" }, perms)).toBe(true);
    expect(canDecide({ status: "completed" }, perms)).toBe(false);
    expect(canDecide({ status: "passed" }, perms)).toBe(false);
  });
});

// ---------------------------------------------------------------- authoring helpers

describe("item and builder forms", () => {
  it("builds a code_fill answer key from the blank markers", () => {
    const f = { ...emptyItemForm("code_fill"), stem: "Fill", code: "x = {{blank:1}}\ny = {{ blank:2 }}", blanks: { "1": { accepted: ["1"], tokenWs: true }, "2": { accepted: [" 2 "], tokenWs: false } } };
    expect(parseBlankMarkers(f.code)).toEqual([1, 2]);
    expect(itemFormErrors(f)).toEqual([]);
    expect(toItemBody(f).answer_key).toEqual({ blanks: { "1": { accepted: ["1"], normalise: { token_ws: true } }, "2": { accepted: ["2"], normalise: { token_ws: false } } } });
  });

  it("requires the correct option for single choice", () => {
    const f = { ...emptyItemForm("single"), stem: "Q", choices: [{ id: "a", text: "A" }, { id: "b", text: "B" }] };
    expect(itemFormErrors(f)).toContain("Mark the correct answer.");
    expect(toItemBody({ ...f, correct: ["b"] }).answer_key).toEqual({ correct: "b" });
  });

  it("serialises a draw rule with an ordered difficulty range", () => {
    const s = { ...newSection(0), mode: "draw" as const, difficulty: [4, 2] as [number, number], count: 3, drawTags: ["sql"] };
    expect(sectionErrors([s])).toEqual({});
    expect(toDraft([s])[0]).toEqual({ key: "s1", title: "Section 1", time_limit_minutes: null, draw: { skill_keys: [], tags: ["sql"], difficulty: [2, 4], count: 3 } });
  });
});
