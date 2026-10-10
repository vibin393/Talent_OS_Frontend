/** Human summary of approval request facts ("2 positions · bill 1,500 · margin 22.0%"). */
export function keyFacts(facts: Record<string, unknown>): string {
  const parts: string[] = [];
  const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
  const positions = n(facts.positions);
  if (positions !== null && Number.isFinite(positions)) parts.push(`${positions} position${positions === 1 ? "" : "s"}`);
  const bill = n(facts.bill_rate);
  if (bill !== null && Number.isFinite(bill)) parts.push(`bill ${bill.toLocaleString("en-US")}`);
  const pay = n(facts.pay_rate);
  if (pay !== null && Number.isFinite(pay)) parts.push(`pay ${pay.toLocaleString("en-US")}`);
  const margin = n(facts.margin_percent);
  if (margin !== null && Number.isFinite(margin)) parts.push(`margin ${margin.toFixed(1)}%`);
  if (typeof facts.country === "string" && facts.country) parts.push(facts.country);
  if (typeof facts.employment_type === "string" && facts.employment_type) parts.push(facts.employment_type.replace(/_/g, " "));
  return parts.join(" · ") || "—";
}
