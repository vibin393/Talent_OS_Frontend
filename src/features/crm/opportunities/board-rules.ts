/** Board drag-and-drop rules (pure, unit-tested). Mirrors the backend opportunity state machine. */
import { OPEN_STAGES } from "../format";
import type { BoardOut, OpportunityOut, OpportunityStage } from "../types";

export type DropAction =
  | { kind: "none" }
  | { kind: "transition"; to: OpportunityStage }
  | { kind: "lost" }
  | { kind: "won" }
  | { kind: "reopen" }
  | { kind: "refused"; reason: string };

const isOpen = (s: OpportunityStage) => OPEN_STAGES.includes(s);

/** What dropping a card in `from` onto column `to` does. */
export function dropAction(from: OpportunityStage, to: OpportunityStage): DropAction {
  if (from === to) return { kind: "none" };
  if (isOpen(from)) {
    if (to === "won") return { kind: "won" };
    if (to === "lost") return { kind: "lost" };
    if (OPEN_STAGES.indexOf(to) > OPEN_STAGES.indexOf(from)) return { kind: "transition", to };
    return { kind: "refused", reason: "Opportunities only move forward between open stages." };
  }
  if (from === "lost" && to === "qualification") return { kind: "reopen" };
  if (from === "won") return { kind: "refused", reason: "Won opportunities cannot be moved." };
  return { kind: "refused", reason: "Reopened opportunities go back to Qualification." };
}

/** Column is dimmed (not a valid drop target) while dragging a card from `from`. */
export function isColumnDimmed(from: OpportunityStage | null, column: OpportunityStage): boolean {
  if (from === null || from === column) return false;
  return dropAction(from, column).kind === "refused";
}

/** Toast text for conflict codes that revert an optimistic move. */
export function conflictMessage(code: string): string {
  switch (code) {
    case "stage_conflict":
      return "Someone else moved this opportunity. The board was refreshed.";
    case "use_won_conversion":
      return "Use the Won dialog to close an opportunity as won.";
    case "reason_code_required":
      return "A reason is required.";
    default:
      return "The move was refused.";
  }
}

/** Move a card between board columns in a cached board (optimistic drag). */
export function moveCard(board: BoardOut, id: string, to: OpportunityOut["stage"]): BoardOut {
  let card: OpportunityOut | undefined;
  const without = board.columns.map((c) => {
    const found = c.items.find((i) => i.id === id);
    if (!found) return c;
    card = found;
    return { ...c, count: c.count - 1, items: c.items.filter((i) => i.id !== id) };
  });
  if (!card) return board;
  const moved = { ...card, stage: to };
  return {
    columns: without.map((c) => (c.stage === to ? { ...c, count: c.count + 1, items: [moved, ...c.items] } : c)),
  };
}
