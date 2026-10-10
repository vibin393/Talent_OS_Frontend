import { describe, expect, it } from "vitest";
import type { BoardOut, OpportunityOut } from "../types";
import { conflictMessage, dropAction, isColumnDimmed, moveCard } from "./board-rules";

describe("board drop rules", () => {
  it("drop on Won opens the Won dialog", () => {
    expect(dropAction("negotiation", "won")).toEqual({ kind: "won" });
    expect(dropAction("qualification", "won")).toEqual({ kind: "won" });
  });

  it("drop on Lost asks for a reason", () => {
    expect(dropAction("proposal", "lost")).toEqual({ kind: "lost" });
  });

  it("forward moves transition directly", () => {
    expect(dropAction("qualification", "proposal")).toEqual({ kind: "transition", to: "proposal" });
    expect(dropAction("qualification", "negotiation")).toEqual({ kind: "transition", to: "negotiation" });
  });

  it("backward moves are refused and their columns dimmed", () => {
    expect(dropAction("negotiation", "proposal").kind).toBe("refused");
    expect(isColumnDimmed("negotiation", "qualification")).toBe(true);
    expect(isColumnDimmed("negotiation", "proposal")).toBe(true);
    expect(isColumnDimmed("negotiation", "won")).toBe(false);
    expect(isColumnDimmed("negotiation", "lost")).toBe(false);
    expect(isColumnDimmed("qualification", "proposal")).toBe(false);
    expect(isColumnDimmed(null, "qualification")).toBe(false);
  });

  it("lost reopens only to Qualification; won never moves", () => {
    expect(dropAction("lost", "qualification")).toEqual({ kind: "reopen" });
    expect(dropAction("lost", "proposal").kind).toBe("refused");
    expect(dropAction("won", "negotiation").kind).toBe("refused");
    expect(dropAction("proposal", "proposal")).toEqual({ kind: "none" });
  });

  it("explains conflicts that revert a move", () => {
    expect(conflictMessage("stage_conflict")).toMatch(/refreshed/);
    expect(conflictMessage("use_won_conversion")).toMatch(/Won dialog/);
  });

  it("moves a card between columns optimistically", () => {
    const card = { id: "o1", stage: "qualification" } as OpportunityOut;
    const board: BoardOut = {
      columns: [
        { stage: "qualification", count: 1, totals: [], items: [card] },
        { stage: "proposal", count: 0, totals: [], items: [] },
      ],
    };
    const next = moveCard(board, "o1", "proposal");
    expect(next.columns[0]).toMatchObject({ count: 0, items: [] });
    expect(next.columns[1].count).toBe(1);
    expect(next.columns[1].items[0].stage).toBe("proposal");
    expect(board.columns[0].items).toHaveLength(1);
  });
});
