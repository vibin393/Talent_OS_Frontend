import { describe, expect, it } from "vitest";
import type { HelpMessage } from "./api";
import { answerText, assistantFooter, citationChip, counter, HANDOFF_TEXT, isUnavailable, UNAVAILABLE_TEXT } from "./logic";

const msg = (over: Partial<HelpMessage>): HelpMessage => ({
  id: "m", seq: 1, author: "assistant", text: "", citations: [], feedback: null, sent_at: "2026-10-10T10:00:00Z", ...over,
});

describe("onboarding help", () => {
  it("renders citation chips", () => {
    expect(citationChip({ kind: "knowledge", label: "IT FAQ" })).toBe("Source: IT FAQ");
    expect(citationChip({ kind: "task", label: "Upload PAN" })).toBe("Your task: Upload PAN");
  });

  it("labels assistant answers on behalf of the coordinator and hides the stored disclosure line", () => {
    expect(assistantFooter("Ada")).toBe("AI assistant · on behalf of Ada");
    const m = msg({ text: "Laptops are issued on day one.\n\nThis message was prepared by an AI assistant for Ada." });
    expect(answerText(m)).toBe("Laptops are issued on day one.");
    expect(answerText(msg({ author: "you", text: "hi" }))).toBe("hi");
  });

  it("recognises the unavailable state and the hand-off line", () => {
    expect(isUnavailable(msg({ author: "system", text: UNAVAILABLE_TEXT }))).toBe(true);
    expect(isUnavailable(msg({ author: "system", text: HANDOFF_TEXT }))).toBe(false);
  });

  it("counts characters against the 2,000 limit", () => {
    expect(counter("abc")).toBe("3 / 2000");
  });
});
