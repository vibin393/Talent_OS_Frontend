import { describe, expect, it } from "vitest";
import { cleanAnswers, formatAnswer, questionKey, validateAnswers } from "./validation";

const Q = [
  { key: "interest", label: "Interested?", type: "boolean", required: true },
  { key: "notice", label: "Notice (days)", type: "number", required: true },
  { key: "mode", label: "Mode", type: "choice", options: ["Remote", "Onsite"] },
  { key: "comm", label: "Communication", type: "rating" },
  { key: "ctc", label: "Expected CTC", type: "money" },
  { key: "start", label: "Start date", type: "date" },
  { key: "notes", label: "Anything else", type: "text" },
];

describe("screening form validation", () => {
  it("flags missing required answers only when completing", () => {
    expect(validateAnswers(Q, {}, false)).toEqual({});
    expect(Object.keys(validateAnswers(Q, {}, true)).sort()).toEqual(["interest", "notice"]);
  });
  it("validates each answer type", () => {
    const errs = validateAnswers(
      Q,
      { interest: true, notice: "-3", mode: "Hybrid", comm: 7, ctc: { amount: "abc", currency: "INR" }, start: "31/12/2026" },
      true,
    );
    expect(Object.keys(errs).sort()).toEqual(["comm", "ctc", "mode", "notice", "start"]);
  });
  it("accepts a valid set and cleans the payload", () => {
    const answers = {
      interest: false,
      notice: "30",
      mode: "Remote",
      comm: 4,
      ctc: { amount: " 1200000 ", currency: "INR" },
      start: "2026-11-01",
      notes: "  hi ",
    };
    expect(validateAnswers(Q, answers, true)).toEqual({});
    expect(cleanAnswers(Q, answers)).toEqual({
      interest: false,
      notice: 30,
      mode: "Remote",
      comm: 4,
      ctc: { amount: "1200000", currency: "INR" },
      start: "2026-11-01",
      notes: "hi",
    });
  });
  it("formats answers for review", () => {
    expect(formatAnswer(Q[0], true)).toBe("Yes");
    expect(formatAnswer(Q[3], 4)).toBe("4 / 5");
    expect(formatAnswer(Q[4], { amount: "10", currency: "USD" })).toBe("10 USD");
    expect(formatAnswer(undefined, { city: "Pune", country: "IN" })).toBe("Pune, IN");
    expect(formatAnswer(Q[6], "")).toBe("—");
  });
  it("builds unique question keys", () => {
    expect(questionKey("Notice period?", new Set())).toBe("notice_period");
    expect(questionKey("Notice period?", new Set(["notice_period"]))).toBe("notice_period_2");
  });
});
