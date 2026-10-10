/**
 * Decimal-string money helpers (Epic 27, AD-20). Amounts arrive as decimal strings; they are parsed digit by
 * digit into integer minor units (exact for any realistic amount), summed as integers and formatted back.
 * No parseFloat / Number(amount) on a fractional value anywhere.
 */

const DEC_RE = /^([+-])?(\d+)(?:\.(\d+))?$/;

/** Minor-unit digits of an ISO-4217 currency (INR 2, JPY 0); 2 when unknown. */
export function currencyDigits(currency: string | null | undefined): number {
  const cur = (currency || "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(cur)) return 2;
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: cur }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/**
 * Parse a decimal string into integer units of 10^-scale (HALF_UP when it has more digits than `scale`);
 * `null` when empty / malformed.
 */
export function toMinor(value: string | null | undefined, scale = 2): number | null {
  if (value === null || value === undefined) return null;
  const m = DEC_RE.exec(value.trim());
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const frac = m[3] ?? "";
  const kept = frac.slice(0, scale).padEnd(scale, "0");
  let units = Number(m[2] + kept);
  if (frac.length > scale && Number(frac[scale]) >= 5) units += 1;
  return units === 0 ? 0 : sign * units;
}

/** Integer minor units back to a plain decimal string ("1026.57", "-0.50", "1785"). */
export function fromMinor(units: number, scale = 2): string {
  const neg = units < 0;
  const abs = String(Math.abs(Math.trunc(units))).padStart(scale + 1, "0");
  const s = scale > 0 ? `${abs.slice(0, abs.length - scale)}.${abs.slice(abs.length - scale)}` : abs;
  return neg ? `-${s}` : s;
}

/** Sum decimal strings exactly (empty / invalid count as zero). `["0.34","0.34","0.34"]` -> `"1.02"`. */
export function sumMoney(values: (string | null | undefined)[], scale = 2): string {
  return fromMinor(
    values.reduce<number>((acc, v) => acc + (toMinor(v, scale) ?? 0), 0),
    scale,
  );
}

/** Normalise to `scale` decimals ("9.5" -> "9.50"); "" when empty / invalid. */
export function normalizeDecimal(value: string | null | undefined, scale = 2): string {
  const u = toMinor(value, scale);
  return u === null ? "" : fromMinor(u, scale);
}

/** A valid non-negative money input with at most `scale` decimals (empty is invalid). */
export function isValidAmountInput(value: string, scale = 2): boolean {
  const v = value.trim();
  if (!v) return false;
  const re = scale > 0 ? new RegExp(`^\\d{1,13}(\\.\\d{1,${scale}})?$`) : /^\d{1,13}$/;
  return re.test(v);
}

/**
 * Format a decimal money string with the currency symbol and locale grouping (INR uses en-IN lakh grouping),
 * without float conversion: the integer part is formatted by Intl (exact for integers) and the fraction digits
 * are spliced in from the string. `"1026.57", "INR"` -> `"₹1,026.57"`. `null`/empty -> "—".
 */
export function formatMoney(amount: string | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const cur = (currency || "").toUpperCase();
  const digits = currencyDigits(cur);
  const units = toMinor(amount, digits);
  if (units === null) return amount;
  const plain = fromMinor(units, digits);
  const neg = plain.startsWith("-");
  const [intPart, fracPart = ""] = (neg ? plain.slice(1) : plain).split(".");
  const intNum = Number(intPart); // integer only: exact
  const locale = cur === "INR" ? "en-IN" : undefined;
  let parts: Intl.NumberFormatPart[];
  try {
    parts = new Intl.NumberFormat(locale, {
      ...(/^[A-Z]{3}$/.test(cur) ? { style: "currency" as const, currency: cur } : {}),
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).formatToParts(intNum);
  } catch {
    parts = new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).formatToParts(intNum);
  }
  const body = parts.map((p) => (p.type === "fraction" ? fracPart : p.value)).join("");
  return neg ? `-${body}` : body;
}
