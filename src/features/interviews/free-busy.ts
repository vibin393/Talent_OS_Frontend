/**
 * Slot mapping for the scheduling-assistant strip: 30-minute columns from 08:00 to 20:00 of the chosen day in
 * the chosen time zone, busy blocks mapped onto them, and screen-reader summaries per row.
 */
import { minutesToTime, toUtcPreview } from "@/lib/time/zones";

export const SLOT_MINUTES = 30;
export const DAY_START_MINUTES = 8 * 60;
export const DAY_END_MINUTES = 20 * 60;

export type Slot = { index: number; label: string; startMinutes: number; startUtc: number | null; endUtc: number | null };
export type Busy = { start: string; end: string };

/** The strip's slots for `date` (YYYY-MM-DD) in `tz`. A slot inside a DST gap has null instants. */
export function daySlots(date: string, tz: string, start = DAY_START_MINUTES, end = DAY_END_MINUTES, step = SLOT_MINUTES): Slot[] {
  const out: Slot[] = [];
  for (let m = start, i = 0; m < end; m += step, i++) {
    const s = toUtcPreview(date, minutesToTime(m), tz);
    const startUtc = s ? Date.parse(s) : null;
    out.push({ index: i, label: minutesToTime(m), startMinutes: m, startUtc, endUtc: startUtc === null ? null : startUtc + step * 60_000 });
  }
  return out;
}

/** The UTC window the strip covers (for the free/busy request), or null when the day cannot be resolved. */
export function stripRange(slots: readonly Slot[]): { startUtc: string; endUtc: string } | null {
  const valid = slots.filter((s) => s.startUtc !== null);
  if (!valid.length) return null;
  return { startUtc: new Date(valid[0].startUtc!).toISOString(), endUtc: new Date(valid[valid.length - 1].endUtc!).toISOString() };
}

/** Indexes of the slots a set of busy blocks overlaps (half-open intervals). */
export function busySlotIndexes(busy: readonly Busy[], slots: readonly Slot[]): Set<number> {
  const out = new Set<number>();
  const blocks = busy.map((b) => [Date.parse(b.start), Date.parse(b.end)] as const).filter(([s, e]) => e > s);
  for (const slot of slots) {
    if (slot.startUtc === null || slot.endUtc === null) continue;
    if (blocks.some(([s, e]) => s < slot.endUtc! && e > slot.startUtc!)) out.add(slot.index);
  }
  return out;
}

/** Slot indexes covered by a proposed start (minutes since midnight) and duration. */
export function proposedSlotIndexes(startMinutes: number, durationMinutes: number, slots: readonly Slot[], step = SLOT_MINUTES): Set<number> {
  const out = new Set<number>();
  if (!Number.isFinite(startMinutes) || durationMinutes <= 0) return out;
  const end = startMinutes + durationMinutes;
  for (const slot of slots) if (slot.startMinutes < end && slot.startMinutes + step > startMinutes) out.add(slot.index);
  return out;
}

/** Merge consecutive slot indexes into "10:00–11:00" ranges. */
export function slotRanges(indexes: Set<number>, slots: readonly Slot[], step = SLOT_MINUTES): string[] {
  const sorted = [...indexes].sort((a, b) => a - b);
  const ranges: string[] = [];
  let runStart: number | null = null;
  let prev: number | null = null;
  const flush = () => {
    if (runStart === null || prev === null) return;
    const a = slots[runStart];
    const b = slots[prev];
    ranges.push(`${a.label}–${minutesToTime(b.startMinutes + step)}`);
  };
  for (const i of sorted) {
    if (prev !== null && i === prev + 1) {
      prev = i;
      continue;
    }
    flush();
    runStart = i;
    prev = i;
  }
  flush();
  return ranges;
}

/** Row summary for assistive tech: "Priya: busy 10:00–11:00, 14:00–14:30" / "Priya: free" / "Priya: calendar not connected". */
export function rowSummary(name: string, status: "available" | "unknown", busyIndexes: Set<number>, slots: readonly Slot[]): string {
  if (status === "unknown") return `${name}: calendar not connected`;
  const ranges = slotRanges(busyIndexes, slots);
  return ranges.length ? `${name}: busy ${ranges.join(", ")}` : `${name}: free all day`;
}

/** Whether the proposed slot overlaps anyone's busy time. */
export function hasConflict(proposed: Set<number>, busyRows: readonly Set<number>[]): boolean {
  return busyRows.some((row) => [...proposed].some((i) => row.has(i)));
}
