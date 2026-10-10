import { labelFor, REFUSAL_LABELS } from "./logic";
import type { EnrolOut, EnrolRefusal } from "./types";

/** Refusals grouped by reason, largest first. */
export function refusalCounts(refused: EnrolRefusal[]): { reason: string; label: string; count: number }[] {
  const by = new Map<string, number>();
  for (const r of refused) by.set(r.reason, (by.get(r.reason) ?? 0) + 1);
  return [...by.entries()]
    .map(([reason, count]) => ({ reason, label: labelFor(REFUSAL_LABELS, reason), count }))
    .sort((a, b) => b.count - a.count);
}

export function enrolSummary(r: Pick<EnrolOut, "enrolled" | "refused">): string {
  const enrolled = `${r.enrolled.toLocaleString()} enrolled`;
  return r.refused.length ? `${enrolled}, ${r.refused.length.toLocaleString()} not enrolled` : enrolled;
}
