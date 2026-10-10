/**
 * Epic 64: the Copilot card for `analytics_answer` targets. Epic 54 owns the card registry (`registerCopilotCard`);
 * until it lands this module only exports the card so `features/copilot/card-renderers.ts` can register it with one
 * additive line: `registerCopilotCard(ANALYTICS_CARD.kind, ANALYTICS_CARD.component)`.
 */
import { AnalyticsAnswerCard } from "./analytics-answer-card";

export const ANALYTICS_CARD = {
  kind: "analytics_answer",
  /** Renders the answer from the tool call target id. */
  component: AnalyticsAnswerCard,
} as const;
