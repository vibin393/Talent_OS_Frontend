/**
 * Time-zone helpers for display (AD-14). The server stores UTC and converts local times itself; these
 * helpers only list zones, label offsets and preview what a local time means in UTC or in another zone.
 */

const FALLBACK_ZONES = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
];

/** The browser's IANA zone ("UTC" when unknown). */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Whether `tz` is a zone this runtime understands. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Every supported IANA zone, with `preferred` zones (e.g. the user's) first and no duplicates. */
export function listTimeZones(...preferred: (string | null | undefined)[]): string[] {
  let all: string[];
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    all = intl.supportedValuesOf ? intl.supportedValuesOf("timeZone") : FALLBACK_ZONES;
  } catch {
    all = FALLBACK_ZONES;
  }
  const first = preferred.filter((z): z is string => !!z && isValidTimeZone(z));
  const out = [...first, ...all, "UTC"];
  return [...new Set(out)];
}

const partsCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    });
    partsCache.set(tz, f);
  }
  return f;
}

export type LocalParts = {
  /** `YYYY-MM-DD` in the zone. */
  date: string;
  /** `HH:MM` (24 h) in the zone. */
  time: string;
  /** Minutes since local midnight. */
  minutes: number;
  /** Short weekday ("Tue"). */
  weekday: string;
};

/** The wall-clock parts of a UTC instant in `tz`. */
export function localParts(utc: string | number | Date, tz: string): LocalParts {
  const d = utc instanceof Date ? utc : new Date(utc);
  const map: Record<string, string> = {};
  for (const p of partsFormatter(tz).formatToParts(d)) map[p.type] = p.value;
  const hour = map.hour === "24" ? "00" : map.hour;
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${hour}:${map.minute}`,
    minutes: Number(hour) * 60 + Number(map.minute),
    weekday: map.weekday,
  };
}

/** Offset of `tz` from UTC in minutes at `at` (e.g. +330 for Asia/Kolkata). */
export function offsetMinutes(tz: string, at: string | number | Date = Date.now()): number {
  const d = at instanceof Date ? at : new Date(at);
  const map: Record<string, string> = {};
  for (const p of partsFormatter(tz).formatToParts(d)) map[p.type] = p.value;
  const hour = map.hour === "24" ? 0 : Number(map.hour);
  const asUtc = Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), hour, Number(map.minute), Number(map.second));
  const whole = Math.floor(d.getTime() / 1000) * 1000;
  return Math.round((asUtc - whole) / 60_000);
}

/** "UTC+05:30" / "UTC-04:00" / "UTC+00:00". */
export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const h = String(Math.floor(abs / 60)).padStart(2, "0");
  const m = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${h}:${m}`;
}

/** "Asia/Kolkata (UTC+05:30)" at `at`. */
export function zoneLabel(tz: string, at: string | number | Date = Date.now()): string {
  return `${tz.replace(/_/g, " ")} (${formatOffset(offsetMinutes(tz, at))})`;
}

/** Short zone abbreviation ("IST", "EDT", "GMT"); falls back to the UTC offset when only "GMT+x" exists. */
export function zoneAbbreviation(tz: string, at: string | number | Date = Date.now()): string {
  const d = at instanceof Date ? at : new Date(at);
  for (const locale of ["en-US", "en-IN", "en-GB"]) {
    try {
      const name = new Intl.DateTimeFormat(locale, { timeZone: tz, timeZoneName: "short" })
        .formatToParts(d)
        .find((p) => p.type === "timeZoneName")?.value;
      if (name && !/^(GMT|UTC)[+-]/.test(name)) return name === "GMT" && tz === "UTC" ? "UTC" : name;
    } catch {
      // try the next locale
    }
  }
  return formatOffset(offsetMinutes(tz, d));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Tue 6 Oct, 10:30 IST" for a UTC instant shown in `tz`. `withYear` adds the year after the month. */
export function formatInZone(isoUtc: string | number | Date, tz: string, opts: { withYear?: boolean; withZone?: boolean } = {}): string {
  const d = isoUtc instanceof Date ? isoUtc : new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return "—";
  const p = localParts(d, tz);
  const [y, m, day] = p.date.split("-");
  const date = `${p.weekday} ${Number(day)} ${MONTHS[Number(m) - 1]}${opts.withYear ? ` ${y}` : ""}`;
  const zone = opts.withZone === false ? "" : ` ${zoneAbbreviation(tz, d)}`;
  return `${date}, ${p.time}${zone}`;
}

/** "10:30" in `tz`. */
export function formatTimeInZone(isoUtc: string | number | Date, tz: string): string {
  return localParts(isoUtc, tz).time;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

/**
 * The UTC instant (ISO string) of a wall-clock `localDate` + `localTime` in `tz`, or null when the input is
 * malformed or the local time does not exist (DST gap). Display only: the server does the real conversion.
 */
export function toUtcPreview(localDate: string, localTime: string, tz: string): string | null {
  const dm = DATE_RE.exec(localDate);
  const tm = TIME_RE.exec(localTime);
  if (!dm || !tm || !isValidTimeZone(tz)) return null;
  const [y, mo, d] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
  const [h, mi] = [Number(tm[1]), Number(tm[2])];
  if (h > 23 || mi > 59) return null;
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes settle the offset around DST transitions; the earlier instant wins for ambiguous times (fold=0).
  const first = guess - offsetMinutes(tz, guess) * 60_000;
  const second = guess - offsetMinutes(tz, first) * 60_000;
  const candidates = [...new Set([first, second])].sort((a, b) => a - b);
  const want = `${localDate} ${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
  for (const c of candidates) {
    const p = localParts(c, tz);
    if (`${p.date} ${p.time}` === want) return new Date(c).toISOString();
  }
  return null;
}

/** `YYYY-MM-DD` shifted by `days` (calendar arithmetic, zone independent). */
export function addDays(date: string, days: number): string {
  const m = DATE_RE.exec(date);
  if (!m) return date;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days);
  return new Date(t).toISOString().slice(0, 10);
}

/** Day of week of `YYYY-MM-DD` (0 = Sunday). */
export function dayOfWeek(date: string): number {
  const m = DATE_RE.exec(date);
  if (!m) return 0;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
}

/** Whole days from `a` to `b` (both `YYYY-MM-DD`). */
export function daysBetween(a: string, b: string): number {
  const pa = DATE_RE.exec(a);
  const pb = DATE_RE.exec(b);
  if (!pa || !pb) return 0;
  const ta = Date.UTC(Number(pa[1]), Number(pa[2]) - 1, Number(pa[3]));
  const tb = Date.UTC(Number(pb[1]), Number(pb[2]) - 1, Number(pb[3]));
  return Math.round((tb - ta) / 86_400_000);
}

/** Today's `YYYY-MM-DD` in `tz`. */
export function todayInZone(tz: string, now: number = Date.now()): string {
  return localParts(now, tz).date;
}

/** `HH:MM` from minutes since midnight. */
export function minutesToTime(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Minutes since midnight from `HH:MM` (NaN when malformed). */
export function timeToMinutes(time: string): number {
  const m = TIME_RE.exec(time);
  return m ? Number(m[1]) * 60 + Number(m[2]) : Number.NaN;
}
