/**
 * Copilot answer cards (Epic 54): an assistant message lists `cards: [{kind, id}]` (the targets of its read tools).
 * Only kinds registered here render (e.g. Epic 64 registers `analytics_answer` from its own feature folder), so the
 * Copilot has no per-capability code.
 */
import { type ComponentType, createElement } from "react";
import { ANALYTICS_CARD } from "@/features/agents/analytics/register";

export interface CopilotCardProps {
  id: string;
  kind: string;
}

const cards = new Map<string, ComponentType<CopilotCardProps>>();

export function registerCopilotCard(kind: string, component: ComponentType<CopilotCardProps>): void {
  cards.set(kind, component);
}

export function copilotCard(kind: string): ComponentType<CopilotCardProps> | undefined {
  return cards.get(kind);
}

// Epic 64: governed analytics answers (the card takes the answer id = the read tool's target id).
registerCopilotCard(ANALYTICS_CARD.kind, ({ id }) => createElement(ANALYTICS_CARD.component, { answerId: id }));
