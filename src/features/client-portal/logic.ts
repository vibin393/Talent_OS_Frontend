/** Pure logic of the Client Portal content pages (Epic 18). */
import type { SlotIn } from "./types";

export const COMPARE_MAX = 4;
export const COMPARE_MIN = 2;
export const MAX_SLOTS = 5;

/** Toggle a submission in the compare selection; never more than `COMPARE_MAX`. */
export function toggleCompare(selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((s) => s !== id);
  if (selected.length >= COMPARE_MAX) return selected;
  return [...selected, id];
}

export function canCompare(selected: string[]): boolean {
  return selected.length >= COMPARE_MIN && selected.length <= COMPARE_MAX;
}

export type SlotRow = { date: string; start: string; end: string };

/** Validate the "propose interview slots" rows; returns an error per row (null = ok) and the payload. */
export function validateSlots(rows: SlotRow[], tz: string, now: Date = new Date()): { errors: (string | null)[]; slots: SlotIn[] | null } {
  const errors: (string | null)[] = [];
  const slots: SlotIn[] = [];
  if (rows.length < 1 || rows.length > MAX_SLOTS) {
    return { errors: rows.map(() => `Propose 1 to ${MAX_SLOTS} slots`), slots: null };
  }
  for (const r of rows) {
    if (!r.date || !r.start || !r.end) {
      errors.push("Enter a date, start and end time");
      continue;
    }
    const s = new Date(`${r.date}T${r.start}`);
    const e = new Date(`${r.date}T${r.end}`);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) errors.push("Enter a valid date and time");
    else if (e <= s) errors.push("End must be after start");
    else if (s <= now) errors.push("Choose a time in the future");
    else {
      errors.push(null);
      slots.push({ starts_at: s.toISOString(), ends_at: e.toISOString(), tz });
    }
  }
  return { errors, slots: errors.every((x) => x === null) ? slots : null };
}

/** Reject always needs a comment (server: 422 `comment_required`). */
export function commentError(decision: "approve" | "reject" | "interested" | "rejected" | "on_hold", comment: string): string | null {
  if ((decision === "reject" || decision === "rejected") && !comment.trim()) return "Add a comment to explain the rejection";
  return null;
}

/** "for {delegator}" badge text when the hub item is decided on someone's behalf. */
export function delegateBadge(actingForName: string | null | undefined): string | null {
  return actingForName ? `for ${actingForName}` : null;
}

export type NavLike = { href: string; permission?: string };

/** Nav entries the Client User may see (entries without a permission are always visible). */
export function visibleNav<T extends NavLike>(items: T[], permissions: string[]): T[] {
  const set = new Set(permissions);
  return items.filter((i) => !i.permission || set.has(i.permission));
}

/** PO consumption share 0..1 from decimal strings (no floats beyond the ratio). */
export function consumedShare(consumed: string, cap: string | null): number | null {
  if (!cap) return null;
  const c = Number(cap);
  if (!(c > 0)) return null;
  return Math.min(1, Math.max(0, Number(consumed) / c));
}

export function experienceLabel(months: number | null): string {
  if (months === null || months === undefined) return "—";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return y > 0 ? `${y} yr${y > 1 ? "s" : ""}${m ? ` ${m} mo` : ""}` : `${m} mo`;
}

export function availabilityLabel(days: number | null): string {
  if (days === null || days === undefined) return "—";
  return days === 0 ? "Immediate" : `${days} days notice`;
}

export const FEEDBACK_LABEL: Record<string, string> = {
  none: "Awaiting feedback",
  interested: "Interested",
  rejected_pending: "Rejected",
  rejected: "Rejected",
  on_hold: "On hold",
};
