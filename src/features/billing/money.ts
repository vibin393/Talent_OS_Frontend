/**
 * Billing money helpers (Epic 29, AD-20). Amounts are decimal strings end to end: they are grouped digit by digit
 * (Indian lakh / crore grouping for INR, thousands elsewhere) and compared as integer minor units -- never parsed
 * as floating point.
 */

const DEC_RE = /^([+-])?(\d+)(?:\.(\d+))?$/;

/** Minor-unit digits (INR 2, JPY 0); 2 when unknown. */
export function currencyDigits(currency: string | null | undefined): number {
  const cur = (currency || "").toUpperCase();
  if (cur === "JPY" || cur === "KRW") return 0;
  return 2;
}

/** `"1234567.5"` -> `"12,34,567.50"` (INR) / `"1,234,567.50"` (other currencies). */
export function groupDigits(amount: string, currency = "INR"): string {
  const m = DEC_RE.exec((amount ?? "").trim());
  if (!m) return amount ?? "";
  const digits = currencyDigits(currency);
  const sign = m[1] === "-" ? "-" : "";
  let whole = m[2].replace(/^0+(?=\d)/, "");
  const frac = (m[3] ?? "").padEnd(digits, "0").slice(0, digits);
  let grouped: string;
  if (currency.toUpperCase() === "INR" && whole.length > 3) {
    const tail = whole.slice(-3);
    whole = whole.slice(0, -3);
    const groups: string[] = [];
    while (whole.length > 2) {
      groups.unshift(whole.slice(-2));
      whole = whole.slice(0, -2);
    }
    if (whole) groups.unshift(whole);
    grouped = [...groups, tail].join(",");
  } else {
    grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ","); // NOSONAR
  }
  return digits
    ? `${sign}${grouped}.${frac.slice(0, digits)}`
    : `${sign}${grouped}`;
}

const SYMBOL: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

/** `formatMoney({amount: "118000.00", currency: "INR"})` -> `"₹1,18,000.00"`. */
export function formatMoney(value: {
  amount: string | null | undefined;
  currency: string | null | undefined;
}): string {
  if (
    value.amount === null ||
    value.amount === undefined ||
    value.amount === ""
  )
    return "—";
  const cur = (value.currency || "INR").toUpperCase();
  const text = groupDigits(value.amount, cur);
  const symbol = SYMBOL[cur];
  return symbol
    ? text.startsWith("-")
      ? `-${symbol}${text.slice(1)}`
      : `${symbol}${text}`
    : `${text} ${cur}`;
}

/** Decimal string -> integer minor units (HALF_UP); `null` when malformed. */
export function toMinor(
  value: string | null | undefined,
  scale = 2,
): number | null {
  if (value === null || value === undefined) return null;
  const m = DEC_RE.exec(value.trim());
  if (!m) return null;
  const frac = m[3] ?? "";
  let units = Number(m[2] + frac.slice(0, scale).padEnd(scale, "0"));
  if (frac.length > scale && Number(frac[scale]) >= 5) units += 1;
  return m[1] === "-" ? -units : units;
}

/** Integer minor units -> decimal string. */
export function fromMinor(units: number, scale = 2): string {
  const neg = units < 0;
  const abs = String(Math.abs(Math.trunc(units))).padStart(scale + 1, "0");
  const s =
    scale > 0
      ? `${abs.slice(0, abs.length - scale)}.${abs.slice(abs.length - scale)}`
      : abs;
  return neg ? `-${s}` : s;
}

/** Sum decimal strings exactly. */
export function sumAmounts(
  values: (string | null | undefined)[],
  scale = 2,
): string {
  return fromMinor(
    values.reduce((acc, v) => acc + (toMinor(v ?? "0", scale) ?? 0), 0),
    scale,
  );
}
