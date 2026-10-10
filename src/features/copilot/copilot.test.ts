import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnswerMarkdown } from "./answer-markdown";
import { chipText, draftOutcome, isEditable, isToggleShortcut, rateLimitMessage, turnMessage, unavailableMessage } from "./copy";
import { editableFields } from "./draft-card";
import { allowedHref, completedSentences, parseMarkdown, refSet } from "./markdown";
import { chipLabel, contextFromPath, listContext, titlePrefix } from "./page-context";
import { compareIds, INITIAL_STREAM, reduceStream, stateFromMessage } from "./use-copilot-stream";

const DEMAND = "0b2c11e0-9c6f-486e-82c7-7da5bb27465b";
const CAND = "09fe9901-9cb8-4730-9e9e-a38364260642";

describe("page context", () => {
  it("maps record routes with the document title prefix", () => {
    expect(contextFromPath(`/demands/${DEMAND}`, "REQ-1056 | Talent OS")).toEqual({
      route: `/demands/${DEMAND}`,
      entity_type: "demand",
      entity_id: DEMAND,
      label: "Demand REQ-1056",
    });
    expect(contextFromPath(`/clients/${DEMAND}/contacts/${CAND}`, "")?.entity_type).toBe("contact");
    expect(contextFromPath(`/candidates/${CAND}/files`, null)?.label).toBe("Candidate");
    expect(contextFromPath("/candidates", "Candidates")).toBeNull();
    expect(titlePrefix("Talent OS")).toBeNull();
  });

  it("labels list contexts with the filter count and caps ids", () => {
    const ctx = listContext("/candidates", { kind: "candidates", filters: { city: "Pune", skill: ["java", "spring"], q: "", empty: [] }, selected_ids: Array(60).fill(CAND) });
    expect(ctx.label).toBe("Candidates (2 filters)");
    expect(ctx.list?.selected_ids).toHaveLength(50);
    expect(chipLabel(ctx)).toBe("Using: Candidates (2 filters)");
    expect(chipLabel(null)).toBeNull();
  });
});

describe("answer markdown", () => {
  const refs = refSet([["demand", DEMAND]]);

  it("links only known refs on record paths; external URLs and unknown ids are text", () => {
    expect(allowedHref(`/demands/${DEMAND}`, refs)).toBe(`/demands/${DEMAND}`);
    expect(allowedHref(`/demands/${CAND}`, refs)).toBeNull();
    expect(allowedHref("https://evil.test/x", refs)).toBeNull();
    expect(allowedHref(`/admin/${DEMAND}`, refs)).toBeNull();
    const blocks = parseMarkdown(`See [REQ-1056](/demands/${DEMAND}) and [other](/demands/${CAND}) or [site](https://evil.test).`, refs);
    expect(blocks).toHaveLength(1);
    const p = blocks[0];
    if (p.kind !== "p") throw new Error("paragraph expected");
    expect(p.children.filter((n) => n.kind === "link")).toHaveLength(1);
  });

  it("never renders HTML from the model", () => {
    const html = renderToStaticMarkup(
      createElement(AnswerMarkdown, { text: `<script>alert(1)</script> **bold** [x](/demands/${DEMAND}) [y](javascript:alert(1))`, refs: [["demand", DEMAND]] }),
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain(`href="/demands/${DEMAND}"`);
    expect(html).not.toContain("javascript:");
  });

  it("parses lists and tables", () => {
    const blocks = parseMarkdown("- one\n- two\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n1. first\n2. second", refSet([]));
    expect(blocks.map((b) => b.kind)).toEqual(["ul", "table", "ol"]);
  });

  it("announces completed sentences only", () => {
    expect(completedSentences("Two demands are at risk. The first")).toBe("Two demands are at risk.");
    expect(completedSentences("No sentence yet")).toBe("");
  });
});

describe("stream reducer", () => {
  it("orders events, ignores replays and finishes on turn.completed", () => {
    let s = reduceStream(INITIAL_STREAM, { id: "1-0", event: "turn.started", data: {} });
    s = reduceStream(s, { id: "2-0", event: "text.delta", data: { text: "Two " } });
    s = reduceStream(s, { id: "3-0", event: "text.delta", data: { text: "demands." } });
    s = reduceStream(s, { id: "2-0", event: "text.delta", data: { text: "Two " } }); // replay after resume
    s = reduceStream(s, { id: "4-0", event: "tool.finished", data: { tool_key: "sla.at_risk", title: "Checked SLA risk", outcome: "executed", summary: "2 demands at risk" } });
    s = reduceStream(s, { id: "5-0", event: "draft.created", data: { proposal_id: "p1", tool_key: "tasks.create", title: "Create task" } });
    s = reduceStream(s, { id: "5-1", event: "draft.created", data: { proposal_id: "p1", tool_key: "tasks.create", title: "Create task" } });
    s = reduceStream(s, { id: "6-0", event: "turn.completed", data: { status: "completed", reason_code: null } });
    expect(s.text).toBe("Two demands.");
    expect(s.tools).toHaveLength(1);
    expect(s.drafts).toHaveLength(1);
    expect(s.done && s.status === "completed").toBe(true);
    const after = reduceStream(s, { id: "7-0", event: "text.delta", data: { text: "x" } });
    expect(after).toBe(s);
    expect(compareIds("10-0", "9-5")).toBeGreaterThan(0);
  });

  it("falls back to the stored message (polling)", () => {
    const s = stateFromMessage({
      id: "m",
      seq: 2,
      role: "assistant",
      run_id: "r",
      redacted: false,
      created_at: "",
      content: { text: "Done", status: "failed", reason_code: "refused", refs: [], tools: [], drafts: ["p"], cards: [] },
    });
    expect(s.done && s.status === "failed" && s.drafts[0].proposal_id === "p").toBe(true);
  });
});

describe("panel and draft copy", () => {
  it("maps unavailable reasons (no panel without permission)", () => {
    expect(unavailableMessage("not_enabled")).toContain("turned off for your organisation");
    expect(unavailableMessage("kill_switch")).toContain("paused by your administrator");
    expect(unavailableMessage("global_kill")).toBe("Copilot is temporarily unavailable.");
    expect(unavailableMessage("budget_exhausted")).toContain("AI allowance");
    expect(unavailableMessage("no_permission")).toBeNull();
    expect(rateLimitMessage(60, 600)).toBe("You've reached the limit of 60 questions an hour. Try again in 10 minutes.");
  });

  it("maps turn failures", () => {
    expect(turnMessage("completed", null)).toBeNull();
    expect(turnMessage("cancelled", "manual")).toBe("Stopped.");
    expect(turnMessage("stopped", "cap_steps")).toContain("more steps than I'm allowed");
    expect(turnMessage("failed", "refused")).toBe("I can't help with that request.");
    expect(turnMessage("stopped", "timeout")).toContain("couldn't finish");
  });

  it("maps every draft outcome", () => {
    expect(draftOutcome("pending", null)).toBeNull();
    expect(draftOutcome("executed", null)?.text).toMatch(/^Done\./);
    expect(draftOutcome("execution_failed", "forbidden")?.text).toContain("Couldn't complete");
    expect(draftOutcome("execution_failed", "not_available")?.text).toBe("This isn't available yet in your workspace.");
    expect(draftOutcome("stale", null)?.text).toBe("This draft is out of date. Ask Copilot to prepare it again.");
    expect(draftOutcome("expired", null)?.text).toBe("This draft expired");
    expect(draftOutcome("discarded", null)?.text).toBe("Discarded");
  });

  it("offers plain fields for editing, never ids", () => {
    const fields = editableFields({
      args: { recipient_id: CAND, channel: "email", subject: "Hi", body: "Hello" },
      input_schema: {
        properties: {
          recipient_id: { type: "string", format: "uuid" },
          channel: { type: "string" },
          subject: { anyOf: [{ type: "string", maxLength: 200 }, { type: "null" }] },
          body: { type: "string", maxLength: 4000 },
        },
      },
    });
    expect(fields.map((f) => f.key)).toEqual(["channel", "subject", "body"]);
    expect(fields.find((f) => f.key === "body")?.long).toBe(true);
  });

  it("chips and the Alt+C guard", () => {
    expect(chipText({ tool_key: "candidates.search", title: "Searched candidates", outcome: "executed", summary: "41 candidates" })).toBe(
      "Searched candidates: 41 results",
    );
    expect(chipText({ tool_key: "demands.get", title: "Read demand", outcome: "not_found", summary: "" })).toBe("Couldn't read demand");
    expect(isToggleShortcut({ altKey: true, ctrlKey: false, metaKey: false, key: "c", code: "KeyC" })).toBe(true);
    expect(isToggleShortcut({ altKey: false, ctrlKey: false, metaKey: false, key: "c", code: "KeyC" })).toBe(false);
    expect(isEditable(null)).toBe(false);
    expect(isEditable({ tagName: "TEXTAREA" } as unknown as Element)).toBe(true);
  });
});
