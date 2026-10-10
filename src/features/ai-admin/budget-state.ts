/** AI budget thresholds (Epic 12 story 12.4, FR-63): 80 % alert, 100 % bulk paused, 120 % everything blocked. */

export const BUDGET_THRESHOLDS = [80, 100, 120] as const;
/** The progress bar spans 0..MAX_BAR_PERCENT so the 120 % marker is visible. */
export const MAX_BAR_PERCENT = 130;

export type BudgetState = "unlimited" | "ok" | "warning" | "bulk_paused" | "blocked";

export type BudgetView = {
  state: BudgetState;
  percent: number | null;
  /** 0..1 fill of the progress bar (MAX_BAR_PERCENT = full). */
  bar: number;
  color: "brand" | "warning" | "error";
  message: string | null;
  intent: "info" | "warning" | "error" | null;
};

export function budgetState(used: number, budget: number | null | undefined): BudgetView {
  if (budget === null || budget === undefined || budget <= 0) {
    return {
      state: "unlimited",
      percent: null,
      bar: 0,
      color: "brand",
      message: budget === 0 ? "The budget is 0: every AI call is refused." : null,
      intent: budget === 0 ? "error" : null,
    };
  }
  const percent = (Math.max(0, used) / budget) * 100;
  const bar = Math.min(percent, MAX_BAR_PERCENT) / MAX_BAR_PERCENT;
  if (percent >= 120) {
    return {
      state: "blocked",
      percent,
      bar,
      color: "error",
      intent: "error",
      message: "AI is paused: usage passed 120% of the monthly budget. Every AI call is refused until next month or until the budget is raised.",
    };
  }
  if (percent >= 100) {
    return {
      state: "bulk_paused",
      percent,
      bar,
      color: "error",
      intent: "warning",
      message: "Bulk AI paused: the monthly budget is used up. Bulk jobs resume when the budget is raised or next month; interactive use continues until 120%.",
    };
  }
  if (percent >= 80) {
    return { state: "warning", percent, bar, color: "warning", intent: "info", message: "Over 80% of this month's AI budget is used." };
  }
  return { state: "ok", percent, bar, color: "brand", intent: null, message: null };
}

/** Position (0..100 %) of a threshold marker on the bar. */
export function markerPosition(threshold: number): number {
  return (threshold / MAX_BAR_PERCENT) * 100;
}
