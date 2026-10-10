/**
 * Receivables UI logic (Epic 30). Pure, framework-free and float-free: money is a decimal string converted to
 * integer minor units (BigInt) for arithmetic, then formatted back.
 */
import type { CheckResultOut, OpenDocumentOut } from "./types";

const DEC_RE = /^\s*(-)?(\d+)(?:\.(\d{0,2}))?\s*$/;

/** "123.4" -> BigInt(12340) (paise). Invalid / empty -> null. More than 2 decimals is invalid. */
export function toMinor(value: string | null | undefined): bigint | null {
  const m = DEC_RE.exec(value ?? "");
  if (!m) return null;
  const minor = BigInt(m[2]) * BigInt(100) + BigInt((m[3] ?? "").padEnd(2, "0") || "0");
  return m[1] ? -minor : minor;
}

/** BigInt(12340) -> "123.40". */
export function fromMinor(minor: bigint): string {
  const neg = minor < BigInt(0);
  const abs = neg ? -minor : minor;
  const whole = abs / BigInt(100);
  const frac = (abs % BigInt(100)).toString().padStart(2, "0");
  return `${neg ? "-" : ""}${whole.toString()}.${frac}`;
}

export function addAmounts(values: (string | null | undefined)[]): string {
  return fromMinor(values.reduce<bigint>((acc, v) => acc + (toMinor(v) ?? BigInt(0)), BigInt(0)));
}

export function subtract(a: string, b: string): string {
  return fromMinor((toMinor(a) ?? BigInt(0)) - (toMinor(b) ?? BigInt(0)));
}

export function compareAmounts(a: string, b: string): number {
  const x = toMinor(a) ?? BigInt(0);
  const y = toMinor(b) ?? BigInt(0);
  return x === y ? 0 : x < y ? -1 : 1;
}

export function minAmount(a: string, b: string): string {
  return compareAmounts(a, b) <= 0 ? a : b;
}

/** TDS expected = round-half-up(base x rate / 100) on minor units; rate has up to 4 decimals. */
export function expectedTds(base: string, ratePct: string): string | null {
  const b = toMinor(base);
  const m = /^\s*(\d+)(?:\.(\d{0,4}))?\s*$/.exec(ratePct ?? "");
  if (b === null || !m) return null;
  const rate = BigInt(m[1]) * BigInt(10000) + BigInt((m[2] ?? "").padEnd(4, "0") || "0"); // rate x 10^4
  const num = b * rate; // minor x pct x 10^4
  const den = BigInt(100) * BigInt(10000);
  const q = num / den;
  const r = num % den;
  return fromMinor(r * BigInt(2) >= den ? q + BigInt(1) : q);
}

export interface AllocationLine {
  document_id: string;
  document_kind: OpenDocumentOut["document_kind"];
  number: string | null;
  due_date: string | null;
  open: string;
  disputed: string;
  amount: string;
  tds: string;
}

export function linesFromDocuments(docs: OpenDocumentOut[]): AllocationLine[] {
  return docs.map((d) => ({
    document_id: d.document_id,
    document_kind: d.document_kind,
    number: d.number,
    due_date: d.due_date,
    open: d.open_amount,
    disputed: d.disputed_amount,
    amount: "",
    tds: "",
  }));
}

/** Auto mode: oldest due date first, never into disputed amounts, TDS first per line. */
export function autoAllocate(lines: AllocationLine[], paymentAmount: string): AllocationLine[] {
  let remaining = toMinor(paymentAmount) ?? BigInt(0);
  const order = [...lines].sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const amounts = new Map<string, string>();
  for (const l of order) {
    const available = (toMinor(l.open) ?? BigInt(0)) - (toMinor(l.disputed) ?? BigInt(0)) - (toMinor(l.tds) ?? BigInt(0));
    const take = available < remaining ? available : remaining;
    if (take > BigInt(0)) {
      amounts.set(l.document_id, fromMinor(take));
      remaining -= take;
    }
  }
  return lines.map((l) => ({ ...l, amount: amounts.get(l.document_id) ?? "" }));
}

export interface AllocationState {
  allocated: string;
  remaining: string;
  overAllocated: boolean;
  invalid: string[];
  exceedsOpen: string[];
}

/** Live totals of the allocation grid: remaining, over-allocation and per-line errors. */
export function allocationState(lines: AllocationLine[], paymentAmount: string): AllocationState {
  const invalid: string[] = [];
  const exceedsOpen: string[] = [];
  let allocated = BigInt(0);
  for (const l of lines) {
    const amt = l.amount.trim() ? toMinor(l.amount) : BigInt(0);
    const tds = l.tds.trim() ? toMinor(l.tds) : BigInt(0);
    if (amt === null || tds === null || amt < BigInt(0) || tds < BigInt(0)) {
      invalid.push(l.document_id);
      continue;
    }
    if (amt + tds > (toMinor(l.open) ?? BigInt(0))) exceedsOpen.push(l.document_id);
    allocated += amt;
  }
  const pay = toMinor(paymentAmount) ?? BigInt(0);
  return {
    allocated: fromMinor(allocated),
    remaining: fromMinor(pay - allocated),
    overAllocated: allocated > pay,
    invalid,
    exceedsOpen,
  };
}

export function canSubmitPayment(state: AllocationState, paymentAmount: string): boolean {
  const pay = toMinor(paymentAmount);
  return pay !== null && pay > BigInt(0) && !state.overAllocated && state.invalid.length === 0 && state.exceedsOpen.length === 0;
}

/** Close gating: blockers with items refuse; warnings with items need acknowledgement. */
export function closeGate(checks: CheckResultOut[], acknowledged: ReadonlySet<string>): { canClose: boolean; blockers: string[]; unacknowledged: string[] } {
  const blockers = checks.filter((c) => c.severity === "blocker" && c.count > 0).map((c) => c.name);
  const unacknowledged = checks
    .filter((c) => c.severity === "warning" && c.count > 0 && !acknowledged.has(c.name))
    .map((c) => c.name);
  return { canClose: blockers.length === 0 && unacknowledged.length === 0, blockers, unacknowledged };
}

export interface PtpForm {
  kind: string;
  ptp_amount: string;
  ptp_date: string;
}

/** Promise-to-pay validation: amount > 0 with at most 2 decimals and a date on or after today. */
export function validatePtp(form: PtpForm, today: string): Record<string, string> {
  if (form.kind !== "promise_to_pay") return {};
  const errors: Record<string, string> = {};
  const amt = toMinor(form.ptp_amount);
  if (amt === null || amt <= BigInt(0)) errors.ptp_amount = "Enter an amount greater than zero";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.ptp_date)) errors.ptp_date = "Pick the promised date";
  else if (form.ptp_date < today) errors.ptp_date = "The promised date cannot be in the past";
  return errors;
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function bucketLabel(key: string): string {
  if (key === "not_due") return "Not due";
  return `${key} days`;
}

export function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
