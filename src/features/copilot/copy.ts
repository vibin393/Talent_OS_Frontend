/** Epic 54 Copilot UI copy and the pure mappings from statuses / codes to it (B2, B3, B5, B6). */
import type { ProposalStatus } from "@/lib/api/agentic-types";
import type { ToolEntry, TurnStatus, UnavailableReason } from "./types";

export const COPY = {
  title: "Copilot",
  toggleLabel: "Copilot",
  toggleTooltip: "Open Copilot (Alt+C)",
  newChat: "New chat",
  history: "History",
  openFullPage: "Open full page",
  close: "Close",
  emptyTitle: "How can I help?",
  emptyText: "Ask about candidates, demands, interviews and your pipeline. I only see what you can see.",
  placeholder: "Ask Copilot…",
  send: "Send",
  stop: "Stop generating",
  footer: "AI-generated content may be incorrect. Check important details.",
  notUsingPage: "Not using this page",
  usePage: "Use this page",
  helpful: "Helpful",
  notHelpful: "Not helpful",
  tellUsMore: "Tell us more (optional)",
  feedbackHint: "Your comment is shared with your AI administrators. Your conversation is not.",
  sendFeedback: "Send feedback",
  copy: "Copy",
  modeCopilot: "Copilot",
  modeAnalytics: "Ask about your data",
  needsConfirmation: "Needs your confirmation",
  confirm: "Confirm",
  edit: "Edit",
  confirmChanges: "Confirm changes",
  discard: "Discard",
  historyEmpty: "No conversations yet.",
  delete: "Delete",
  deleteTitle: "Delete this conversation?",
  deleteBody: "This permanently deletes the conversation and its drafts. This can't be undone.",
  cancel: "Cancel",
} as const;

export const STARTERS = {
  sla: "Which open demands are at risk of missing SLA?",
  followUp: "Who did we interview but not follow up with?",
  summarise: "Summarise this candidate",
  task: "Create a follow-up task",
} as const;

export const COPILOT_TOGGLE_ID = "copilot-toggle";
export const MAX_QUESTION = 4000;
export const COUNTER_FROM = 3500;

/** Panel-level warning by `status.reason`; `no_permission` renders no panel (null). */
export function unavailableMessage(reason: UnavailableReason | null | undefined): string | null {
  switch (reason) {
    case "not_enabled":
      return "Copilot is turned off for your organisation. Ask your administrator to turn it on.";
    case "kill_switch":
      return "AI agents are paused by your administrator. Copilot is unavailable for now.";
    case "global_kill":
      return "Copilot is temporarily unavailable.";
    case "budget_exhausted":
      return "Your organisation has used this month's AI allowance. Copilot will be back when the allowance resets.";
    default:
      return null;
  }
}

export function rateLimitMessage(limit: number, retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `You've reached the limit of ${limit} questions an hour. Try again in ${minutes} minutes.`;
}

/** Turn-level message for an answer that did not complete (null = completed normally). */
export function turnMessage(status: TurnStatus | null, reasonCode: string | null | undefined): string | null {
  if (status === null || status === "completed") return null;
  if (status === "cancelled") return "Stopped.";
  if (reasonCode === "kill_switch") return "AI agents are paused by your administrator. Copilot is unavailable for now.";
  if (status === "stopped" && reasonCode?.startsWith("cap_")) {
    return "That question needed more steps than I'm allowed. Try a narrower question.";
  }
  if (status === "failed" && reasonCode === "refused") return "I can't help with that request.";
  if (status === "unavailable") return "Copilot couldn't start this answer. Try again.";
  return "I couldn't finish that answer. Try again, or rephrase your question.";
}

const CHIP_VERBS: Record<string, (t: ToolEntry) => string> = {
  "candidates.search": (t) => `Searched candidates: ${count(t.summary)} results`,
  "search.global": (t) => `Searched records: ${count(t.summary)} results`,
  "demands.get": (t) => `Read demand ${t.summary.replace(/^read demand\s*/i, "")}`.trim(),
  "demands.list": (t) => `Listed demands: ${count(t.summary)}`,
  "pipeline.list": (t) => `Listed applications: ${count(t.summary)}`,
  "sla.at_risk": (t) => `Checked SLA risk: ${count(t.summary)} demands`,
  "matching.rank": (t) => `Ranked matches: ${count(t.summary)}`,
  "interviews.list": (t) => `Listed interviews: ${count(t.summary)}`,
  "placements.list": (t) => `Listed placements: ${count(t.summary)}`,
  "tasks.list": (t) => `Listed tasks: ${count(t.summary)}`,
};

function count(summary: string): string {
  const m = /(\d+)/.exec(summary);
  return m ? m[1] : "0";
}

/** Chip text of a tool call ("Searched candidates: 41 results"; "Couldn't read {title}" on failure). */
export function chipText(tool: ToolEntry): string {
  if (tool.outcome && !["executed", "proposed", "deduplicated"].includes(tool.outcome)) {
    return `Couldn't read ${tool.title.replace(/^(read|listed|searched|checked|ranked|found)\s+/i, "").toLowerCase()}`;
  }
  if (tool.outcome === "proposed") return `Drafted: ${tool.title}`;
  const verb = CHIP_VERBS[tool.tool_key];
  return verb ? verb(tool) : tool.title;
}

export function chipFailed(tool: ToolEntry): boolean {
  return Boolean(tool.outcome) && !["executed", "proposed", "deduplicated"].includes(tool.outcome);
}

const ERROR_TEXT: Record<string, string> = {
  forbidden: "You no longer have permission to do this",
  not_available: "This isn't available yet in your workspace.",
  not_found: "The record is no longer available to you",
  recipient_kind_unsupported: "This recipient can't be messaged from Copilot",
};

export type DraftOutcome = { intent: "success" | "error" | "warning" | "info"; text: string } | null;

/** The draft card's outcome bar for a Proposal status (null while pending). */
export function draftOutcome(status: ProposalStatus, errorCode: string | null, resultSummary?: string | null): DraftOutcome {
  switch (status) {
    case "executed":
      return { intent: "success", text: `Done.${resultSummary ? ` ${resultSummary}` : ""}` };
    case "execution_failed":
      if (errorCode === "not_available") return { intent: "warning", text: ERROR_TEXT.not_available };
      return { intent: "error", text: `Couldn't complete: ${ERROR_TEXT[errorCode ?? ""] ?? errorCode ?? "unknown error"}` };
    case "stale":
      return { intent: "warning", text: "This draft is out of date. Ask Copilot to prepare it again." };
    case "expired":
      return { intent: "info", text: "This draft expired" };
    case "discarded":
    case "rejected":
      return { intent: "info", text: "Discarded" };
    default:
      return null;
  }
}

/** Alt+C must not fire while typing in another field (same guard as Alt+Q). */
export function isEditable(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable === true;
}

export function isToggleShortcut(e: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey" | "key" | "code">): boolean {
  return e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "c" || e.key === "C" || e.code === "KeyC");
}
