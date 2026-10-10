/** Epic 62 Onboarding help display logic (Vitest-covered). */
import type { HelpCitation, HelpMessage } from "./api";

export const MAX_QUESTION = 2000;
export const HANDOFF_TEXT = "I'll pass this to your coordinator.";
export const UNAVAILABLE_TEXT = "The onboarding assistant is not available. Your question was sent to your coordinator.";

export function citationChip(c: HelpCitation): string {
  if (c.kind === "task") return `Your task: ${c.label}`;
  if (c.kind === "case") return "Your onboarding";
  return `Source: ${c.label}`;
}

export function assistantFooter(coordinatorName: string): string {
  return `AI assistant · on behalf of ${coordinatorName}`;
}

/** Strip the stored AI disclosure line from the answer (the footer shows it instead). */
export function answerText(m: HelpMessage): string {
  if (m.author !== "assistant") return m.text;
  return m.text.replace(/\n\nThis message was prepared by an AI assistant[^\n]*$/, "");
}

export function isUnavailable(m: HelpMessage): boolean {
  return m.author === "system" && m.text === UNAVAILABLE_TEXT;
}

export function counter(text: string): string {
  return `${text.length} / ${MAX_QUESTION}`;
}
