/**
 * Decimal-string money formatting for Phase 2 dashboards (AD-12/AD-20). Amounts arrive as exact decimal
 * strings and are formatted digit by digit (Indian lakh / crore grouping), never through `parseFloat`, so
 * totals agree with issued documents to the paisa. `toChartNumber` is the only lossy conversion and is used
 * for plotting only.
 */
import type { Money } from "./types";

const SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "AED ", SGD: "S$" };

export function currencySymbol(currency: string): string {
  return SYMBOLS[currency] ?? `${currency} `;
}

/** "1234567" -> "12,34,567" (Indian grouping: last 3 digits, then pairs). */
export function groupIndian(integer: string): string {
  if (integer.length <= 3) return integer;
  const last3 = integer.slice(-3);
  let rest = integer.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) parts.unshift(rest);
  return `${parts.join(",")},${last3}`;
}

/** Normalise a decimal string: sign, integer digits (no leading zeros), 2 fraction digits (half-up). */
export function parseDecimal(raw: string): { negative: boolean; integer: string; fraction: string } | null {
  const m = /^\s*([+-])?(\d*)(?:\.(\d*))?\s*$/.exec(raw); // NOSONAR
  if (!m || (!m[2] && !m[3])) return null;
  const negative = m[1] === "-";
  let integer = (m[2] || "0").replace(/^0+(?=\d)/, "");
  let fraction = (m[3] ?? "").padEnd(3, "0");
  const roundUp = Number(fraction[2]) >= 5;
  fraction = fraction.slice(0, 2);
  if (roundUp) {
    // Increment the 2-digit fraction / integer as strings (no floating point).
    let cents = String(Number(fraction) + 1).padStart(2, "0");
    if (cents.length > 2) {
      cents = "00";
      integer = incrementDigits(integer);
    }
    fraction = cents;
  }
  const zero = /^0+$/.test(integer) && fraction === "00";
  return { negative: negative && !zero, integer, fraction };
}

function incrementDigits(digits: string): string {
  const out = digits.split("");
  for (let i = out.length - 1; i >= 0; i -= 1) {
    if (out[i] === "9") out[i] = "0";
    else {
      out[i] = String(Number(out[i]) + 1);
      return out.join("");
    }
  }
  return `1${out.join("")}`;
}

export type MoneyStyle = "minus" | "parens";

/** "₹12,34,567.50"; negatives as "-₹…" or "(₹…)" (`parens`, the executive grid). Null -> "—". */
export function formatMoney(value: Money | null | undefined, style: MoneyStyle = "minus"): string {
  if (!value) return "—";
  const d = parseDecimal(value.amount);
  if (!d) return "—";
  const body = `${currencySymbol(value.currency)}${groupIndian(d.integer)}.${d.fraction}`;
  if (!d.negative) return body;
  return style === "parens" ? `(${body})` : `-${body}`;
}

/** Compact Indian units for axis ticks: 1.2 L, 3.4 Cr (display only). */
export function formatCompactInr(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}${(abs / 1e7).toFixed(1)} Cr`;
  if (abs >= 1e5) return `${sign}${(abs / 1e5).toFixed(1)} L`;
  return `${sign}${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(abs)}`;
}

/** Percent decimal string ("47.37") -> "47.37%"; null (revenue 0) -> "—". */
export function formatPercent(value: string | number | null | undefined, style: MoneyStyle = "minus"): string {
  if (value === null || value === undefined || value === "") return "—";
  const d = parseDecimal(String(value));
  if (!d) return "—";
  const body = `${d.integer}.${d.fraction}%`;
  if (!d.negative) return body;
  return style === "parens" ? `(${body})` : `-${body}`;
}

/** Plotting only: a decimal string as a JS number (never used for displayed totals). */
export function toChartNumber(value: Money | string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = typeof value === "string" ? value : value.amount;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
