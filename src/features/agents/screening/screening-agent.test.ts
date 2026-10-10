import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { renderProposal } from "@/features/agent-proposals/proposal-renderers";
import { applicationPanels, registerApplicationPanel } from "@/features/pipeline/application-panels";
import { AnswerReviewView } from "./answer-review";
import { CandidateChatView } from "./candidate-chat";
import {
  availableActions,
  bulkAcceptable,
  candidateChatState,
  isBelowThreshold,
  lastSeq,
  mergeSnapshot,
  mergeTurns,
  parseEditedValue,
  reviewGate,
  startErrorText,
  statusBadge,
} from "./logic";
import { ApiError } from "@/lib/api/errors";
import { channelChoices } from "./start-dialog";
import type { AnswerOut, PortalScreeningChat, ReviewOut } from "./types";

function render(el: ReactElement): string {
  return renderToStaticMarkup(createElement(FluentProvider, { theme: webLightTheme }, el));
}

/** The opening `<button ...>` tag of the button whose text contains `label`. */
function buttonTag(html: string, label: string): string {
  const at = html.indexOf(`>${label}<`);
  expect(at).toBeGreaterThan(-1);
  const start = html.lastIndexOf("<button", at);
  return html.slice(start, html.indexOf(">", start) + 1);
}

const turn = (seq: number, body = `m${seq}`) => ({ seq, author: "assistant" as const, body, sent_at: "2026-10-08T10:00:00Z" });

const chat = (over: Partial<PortalScreeningChat> = {}): PortalScreeningChat => ({
  id: "c1",
  title: "Java developer at Acme",
  status: "open",
  recruiter_name: "Priya",
  consent_needed: false,
  can_reply: true,
  notice: { notice_id: "n1", title: "Talking with an AI assistant", body_md: "We use AI." },
  turns: [turn(1, "Hello, I am an AI assistant acting for Priya.")],
  ...over,
});

const noop = () => undefined;
const view = (c: PortalScreeningChat) => render(createElement(CandidateChatView, { chat: c, onConsent: noop, onSend: async () => true, onHandoff: noop }));

describe("after_seq merge", () => {
  it("merges pages by seq, de-duplicates and keeps order", () => {
    const merged = mergeTurns([turn(1), turn(2)], [turn(2, "updated"), turn(4), turn(3)]);
    expect(merged.map((t) => t.seq)).toEqual([1, 2, 3, 4]);
    expect(merged[1].body).toBe("updated");
    expect(lastSeq(merged)).toBe(4);
    expect(lastSeq([])).toBeNull();
  });

  it("keeps earlier turns when a poll returns only new ones, and takes the new status", () => {
    const prev = chat({ turns: [turn(1), turn(2)] });
    const next = mergeSnapshot(prev, chat({ status: "ended", turns: [turn(3)] }));
    expect(next.turns.map((t) => t.seq)).toEqual([1, 2, 3]);
    expect(next.status).toBe("ended");
    expect(mergeSnapshot(undefined, chat({ turns: [turn(2), turn(1)] })).turns.map((t) => t.seq)).toEqual([1, 2]);
  });
});

describe("candidate chat", () => {
  it("gates questions and the composer behind consent", () => {
    const waiting = chat({ status: "waiting_for_consent", consent_needed: true, can_reply: false });
    expect(candidateChatState(waiting)).toMatchObject({ showConsent: true, canType: false, showStop: true });
    const html = view(waiting);
    expect(html).toContain("I agree");
    expect(html).toContain("No thanks");
    expect(html).toContain("How we use AI");
    expect(html).not.toContain("Your answer");
    expect(html).not.toContain(">Send<");
    // consent_needed alone (even with status open / can_reply) still gates
    expect(candidateChatState(chat({ consent_needed: true })).canType).toBe(false);
  });

  it("shows the composer after consent", () => {
    const html = view(chat());
    expect(html).toContain("Your answer");
    expect(html).toContain(">Send<");
    expect(html).not.toContain("I agree");
    expect(html).toContain("Priya · AI assistant");
  });

  it("offers 'Talk to a person' until the chat ends, then the end banner", () => {
    expect(view(chat())).toContain("Talk to a person");
    expect(view(chat({ status: "paused", can_reply: false }))).toContain("Talk to a person");
    const ended = view(chat({ status: "ended", can_reply: false }));
    expect(ended).not.toContain("Talk to a person");
    expect(ended).not.toContain("Your answer");
    expect(ended).toContain("This chat has ended. Priya will follow up.");
  });

  it("renders the transcript as a polite live log", () => {
    const html = view(chat());
    expect(html).toMatch(/<ol[^>]*role="log"/);
    expect(html).toMatch(/<ol[^>]*aria-live="polite"/);
    expect(html).toContain("Hello, I am an AI assistant acting for Priya.");
  });
});

const answer = (over: Partial<AnswerOut> = {}): AnswerOut => ({
  id: "a1",
  question_id: "q1",
  question_label: "Notice period",
  question_type: "number",
  unit: "days",
  required: true,
  source: "text",
  answer_text: "around 2 months",
  normalized: { value: 60, unit: "days" },
  confidence: "0.95",
  low_confidence: false,
  flags: [],
  knockout: null,
  status: "unconfirmed",
  edited_value: null,
  segment_refs: [3],
  start_ms: null,
  reviewed_by: null,
  reviewed_at: null,
  ...over,
});

const review = (answers: AnswerOut[], over: Partial<ReviewOut> = {}): ReviewOut => ({
  conversation_id: "c1",
  voice_session_id: null,
  application_id: "app1",
  screening_id: null,
  status: "completed",
  threshold: "0.70",
  summary: "Two of three required answers are clear.",
  gaps: ["Expected salary"],
  suggested_next: null,
  unanswered_required: [],
  answers,
  can_complete: true,
  ...over,
});

const reviewHtml = (r: ReviewOut) => render(createElement(AnswerReviewView, { review: r, onDecide: noop, onEdit: noop, onAcceptConfident: noop, onComplete: noop }));

describe("answer review", () => {
  it("tints answers below the threshold with a 'Check' badge", () => {
    expect(isBelowThreshold(answer({ confidence: "0.5" }), "0.70")).toBe(true);
    expect(isBelowThreshold(answer({ confidence: "0.70" }), "0.70")).toBe(false);
    expect(isBelowThreshold(answer({ confidence: 0.9, low_confidence: true }), "0.70")).toBe(true);
    expect(isBelowThreshold(answer({ confidence: null }), "0.70")).toBe(true);
    expect(reviewHtml(review([answer({ confidence: "0.50" })]))).toMatch(/data-low-confidence="true"[\s\S]*>Check</);
    expect(reviewHtml(review([answer()]))).not.toContain(">Check<");
  });

  it("disables 'Complete review' until every answer is decided, low-confidence ones explicitly", () => {
    const low = answer({ id: "low", confidence: "0.40" });
    const ok = answer({ id: "ok" });
    let gate = reviewGate([low, ok], "0.70");
    expect(gate).toMatchObject({ canComplete: false, undecided: 2, lowConfidenceUndecided: 1 });
    expect(gate.reason).toContain("low-confidence");
    // bulk accept never touches the low-confidence answer
    expect(bulkAcceptable([low, ok], "0.70")).toEqual(["ok"]);
    gate = reviewGate([low, { ...ok, status: "accepted" }], "0.70");
    expect(gate.canComplete).toBe(false);
    gate = reviewGate([{ ...low, status: "edited" }, { ...ok, status: "accepted" }], "0.70");
    expect(gate).toMatchObject({ canComplete: true, reason: null });
    expect(reviewGate([{ ...ok, status: "rejected" }], "0.70", false).canComplete).toBe(false);

    expect(buttonTag(reviewHtml(review([low, ok])), "Complete review")).toContain("disabled");
    expect(buttonTag(reviewHtml(review([{ ...low, status: "accepted" }, { ...ok, status: "rejected" }])), "Complete review")).not.toContain("disabled");
  });

  it("labels the summary as AI-generated and knockouts as flags only", () => {
    const html = reviewHtml(review([answer({ flags: ["knockout"] })]));
    expect(html).toContain("AI summary");
    expect(html).toContain("AI-generated — check before you decide");
    expect(html).toContain(">Flag<");
    expect(html).toContain("Expected salary");
  });

  it("parses edited values per type", () => {
    expect(parseEditedValue("number", "60", "days")).toEqual({ value: 60, unit: "days" });
    expect(parseEditedValue("number", "abc")).toBeNull();
    expect(parseEditedValue("boolean", "Yes")).toEqual({ value: true });
    expect(parseEditedValue("text", "  ")).toBeNull();
  });
});

describe("recruiter controls", () => {
  it("maps statuses to the spec labels and actions", () => {
    expect(statusBadge({ status: "invited", last_outbound_at: "x", consented_at: null }).label).toBe("Waiting for consent");
    expect(statusBadge({ status: "invited", last_outbound_at: null, consented_at: null }).label).toBe("Invited");
    expect(statusBadge({ status: "consent_refused", last_outbound_at: null, consented_at: null }).label).toBe("Consent refused");
    expect(availableActions("in_progress", true)).toEqual(["pause", "take-over", "cancel"]);
    expect(availableActions("paused", true)).toEqual(["resume", "take-over", "cancel"]);
    expect(availableActions("completed", true)).toEqual([]);
    expect(availableActions("in_progress", false)).toEqual([]);
  });

  it("explains start refusals and disabled channels", () => {
    expect(startErrorText(new ApiError(409, "screening_conversation_open", "x"))).toBe("An AI screening is already open");
    expect(startErrorText(new ApiError(409, "alternative_process_requested", "x"))).toBe("The candidate asked for a non-AI process");
    expect(startErrorText(new ApiError(409, "no_channel", "x"))).toBe("No channel to reach this candidate");
    expect(startErrorText(new ApiError(409, "screening_agent_off", "x"))).toBe("The Screening Agent is off");
    const choices = channelChoices({
      channels: [
        { channel: "portal_chat", available: false, reason: "No portal account" },
        { channel: "link_chat", available: true },
        { channel: "whatsapp", available: false, reason: "No WhatsApp opt-in" },
      ],
      best_channel: "link_chat",
      questionnaire_id: "q",
      questionnaire_name: "Default",
      version_id: "v",
      version: 2,
    });
    expect(choices.map((c) => [c.label, c.disabled])).toEqual([
      ["Best available", false],
      ["Candidate portal chat", true],
      ["Chat link by email", false],
      ["WhatsApp", true],
    ]);
    expect(choices[1].reason).toBe("No portal account");
  });
});

describe("registries", () => {
  it("filters application panels by permission and order", () => {
    const Empty = () => null;
    registerApplicationPanel({ key: "t_b", permission: "x:read", order: 20, component: Empty });
    registerApplicationPanel({ key: "t_a", order: 5, component: Empty });
    expect(applicationPanels(() => false).map((p) => p.key)).toContain("t_a");
    expect(applicationPanels(() => false).map((p) => p.key)).not.toContain("t_b");
    const keys = applicationPanels(() => true).map((p) => p.key);
    expect(keys.indexOf("t_a")).toBeLessThan(keys.indexOf("t_b"));
  });

  it("registers a proposal renderer for every Epic 57 tool key", () => {
    for (const key of [
      "screening.invite",
      "screening.ask",
      "screening.clarify",
      "screening.reply_grounded",
      "screening.extract_answers",
      "screening.save_summary",
      "screening.reminder",
      "screening.handoff",
      "screening.propose_candidate_updates",
    ]) {
      const out = renderProposal({ tool_key: key, title: "", preview: { title: "", summary: "s", fields: [["Question", "Notice period"]], renderer: null } });
      expect(out.title.length).toBeGreaterThan(0);
      expect(out.rows).toEqual([{ label: "Question", value: "Notice period" }]);
    }
  });
});
