/** Pure helpers for the AI budget field. */

/** Usage ratio (null when there is no budget) and a label like "12,000 of 100,000 tokens (12%)". */
export function budgetUsage(used: number, budget: number | null): { ratio: number | null; label: string } {
  const u = Math.max(0, used);
  if (budget === null || budget <= 0) {
    return { ratio: null, label: budget === 0 ? `${u.toLocaleString("en-US")} tokens used; the budget is 0` : "No limit" };
  }
  const ratio = u / budget;
  return {
    ratio,
    label: `${u.toLocaleString("en-US")} of ${budget.toLocaleString("en-US")} tokens (${Math.round(ratio * 100)}%)`,
  };
}
