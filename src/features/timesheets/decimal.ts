/**
 * Decimal-string helpers for hours (Epic 25). Hours are never summed with floats: values are converted to
 * integer hundredths, summed, and formatted back to "x.yy".
 */

/** Valid Worker hour input: 1-2 integer digits, optional 1-2 decimals. Empty means "no entry". */
export const HOURS_RE = /^\d{1,2}(\.\d{1,2})?$/;

/** True when `value` is empty or a valid hours string (and <= 24). */
export function isValidHoursInput(value: string): boolean {
  const v = value.trim();
  if (v === "") return true;
  if (!HOURS_RE.test(v)) return false;
  return (toHundredths(v) ?? Infinity) <= 2400;
}

/** Parse a (possibly signed) decimal string with <= 2 dp into integer hundredths; `null` if invalid. */
export function toHundredths(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const v = value.trim();
  const m = /^([+-])?(\d+)(?:\.(\d{1,2}))?$/.exec(v);
  if (!m) {
    // tolerate backend values with more than 2 decimals that are zero-padded ("8.0000")
    const m4 = /^([+-])?(\d+)\.(\d{2})0+$/.exec(v);
    if (!m4) return null;
    return toHundredths(`${m4[1] ?? ""}${m4[2]}.${m4[3]}`);
  }
  const sign = m[1] === "-" ? -1 : 1;
  const whole = Number(m[2]);
  const frac = Number((m[3] ?? "").padEnd(2, "0") || "0");
  return sign * (whole * 100 + frac);
}

/** Format integer hundredths as "x.yy" (with a leading "-" for negatives; `signed` adds "+" for positives). */
export function formatHundredths(h: number, signed = false): string {
  const neg = h < 0;
  const abs = Math.abs(Math.trunc(h));
  const s = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  if (neg) return `-${s}`;
  return signed && abs > 0 ? `+${s}` : s;
}

/** Sum decimal strings exactly; invalid / empty values count as zero. */
export function sumHours(values: (string | null | undefined)[]): string {
  return formatHundredths(values.reduce<number>((acc, v) => acc + (toHundredths(v) ?? 0), 0));
}

/** Normalise a hours value for display ("8" -> "8.00"); returns "" for empty/invalid. */
export function normalizeHours(value: string | null | undefined): string {
  const h = toHundredths(value);
  return h === null ? "" : formatHundredths(h);
}

/** Display a signed delta ("+1.50" / "-1.00"). */
export function formatDelta(value: string): string {
  const h = toHundredths(value);
  return h === null ? value : formatHundredths(h, true);
}
