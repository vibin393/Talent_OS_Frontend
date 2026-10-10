/** Pure positioning for the Outlook-like week view: events placed by start/end in the viewer's time zone. */
import { addDays, dayOfWeek, daysBetween, localParts } from "@/lib/time/zones";

export type CalendarEvent = { id: string; startsAt: string; endsAt: string };

export type PositionedEvent<T extends CalendarEvent = CalendarEvent> = {
  event: T;
  /** 0 = first day of the week (Monday). */
  day: number;
  /** Minutes since local midnight (clamped to the day). */
  top: number;
  /** Minutes long within the day (at least `minHeight`). */
  height: number;
  /** Overlap lane and lane count within its cluster (side-by-side events). */
  lane: number;
  lanes: number;
};

/** Monday (`YYYY-MM-DD`) of the week containing `date`. */
export function weekStart(date: string): string {
  const dow = dayOfWeek(date);
  return addDays(date, -((dow + 6) % 7));
}

/** The 7 dates of the week starting on `start`. */
export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * Position events for the week starting `start` in `tz`. Events spanning midnight are cut at the end of their
 * first visible day; events outside the week are dropped. Overlapping events share the column in lanes.
 */
export function layoutWeek<T extends CalendarEvent>(events: readonly T[], start: string, tz: string, minHeight = 20): PositionedEvent<T>[] {
  const placed: PositionedEvent<T>[] = [];
  for (const event of events) {
    const s = localParts(event.startsAt, tz);
    const e = localParts(event.endsAt, tz);
    const day = daysBetween(start, s.date);
    if (day < 0 || day > 6) continue;
    const endMinutes = e.date === s.date ? e.minutes : 24 * 60;
    const height = Math.max(minHeight, endMinutes - s.minutes);
    placed.push({ event, day, top: s.minutes, height: Math.min(height, 24 * 60 - s.minutes), lane: 0, lanes: 1 });
  }
  placed.sort((a, b) => a.day - b.day || a.top - b.top || b.height - a.height);
  // Assign lanes per overlapping cluster within a day.
  let cluster: PositionedEvent<T>[] = [];
  let clusterEnd = -1;
  let clusterDay = -1;
  const flush = () => {
    const laneEnds: number[] = [];
    for (const p of cluster) {
      let lane = laneEnds.findIndex((end) => end <= p.top);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[lane] = p.top + p.height;
      p.lane = lane;
    }
    for (const p of cluster) p.lanes = laneEnds.length;
    cluster = [];
  };
  for (const p of placed) {
    if (p.day !== clusterDay || p.top >= clusterEnd) {
      flush();
      clusterDay = p.day;
      clusterEnd = p.top + p.height;
    } else {
      clusterEnd = Math.max(clusterEnd, p.top + p.height);
    }
    cluster.push(p);
  }
  flush();
  return placed;
}

/** Keyboard order: chronological; returns the index to focus after `key` from `current`. */
export function nextEventIndex(count: number, current: number, key: string): number {
  if (count === 0) return -1;
  if (key === "ArrowRight" || key === "ArrowDown") return Math.min(count - 1, current + 1);
  if (key === "ArrowLeft" || key === "ArrowUp") return Math.max(0, current - 1);
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return current;
}
