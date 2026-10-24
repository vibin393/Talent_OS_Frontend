/** Pure CRM formatting helpers: labels, badge colours and money from decimal strings. */
import type { CurrencyTotal, LeadStatus, OpportunityStage, ReasonKind, Service } from "./types";

export const LEAD_STATUSES: readonly LeadStatus[] = ["new", "contacted", "qualified", "converted", "disqualified"];
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  disqualified: "Disqualified",
};
export const LEAD_STATUS_COLORS: Record<LeadStatus, "brand" | "informative" | "success" | "subtle" | "danger"> = {
  new: "brand",
  contacted: "informative",
  qualified: "success",
  converted: "subtle",
  disqualified: "danger",
};

export const OPEN_STAGES: readonly OpportunityStage[] = ["qualification", "proposal", "negotiation"];
export const STAGES: readonly OpportunityStage[] = ["qualification", "proposal", "negotiation", "won", "lost"];
export const STAGE_LABELS: Record<OpportunityStage, string> = {
  qualification: "Qualification",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};
export const STAGE_COLORS: Record<OpportunityStage, "brand" | "informative" | "warning" | "success" | "danger"> = {
  qualification: "brand",
  proposal: "informative",
  negotiation: "warning",
  won: "success",
  lost: "danger",
};

export const SERVICES: readonly Service[] = ["contract_staffing", "permanent_placement", "project", "other"];
export const SERVICE_LABELS: Record<Service, string> = {
  contract_staffing: "Contract staffing",
  permanent_placement: "Permanent placement",
  project: "Project",
  other: "Other",
};

export const REASON_KIND_LABELS: Record<ReasonKind, string> = {
  lead_disqualify: "Lead disqualify",
  opportunity_lost: "Opportunity lost",
  reopen: "Reopen",
};

/** Parse a decimal string; null for blank / invalid. */
export function parseDecimal(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Money from a decimal string, e.g. ("1250000.50", "INR") -> "₹12,50,000.50". Blank -> "—". */
export function formatMoney(amount: string | null | undefined, currency: string | null | undefined): string {
  const n = parseDecimal(amount);
  if (n === null) return "—";
  const cur = (currency ?? "").toUpperCase();
  const locale = cur === "INR" ? "en-IN" : "en-US";
  if (/^[A-Z]{3}$/.test(cur)) {
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency: cur, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
    } catch {
      // unknown currency code: fall through
    }
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n)}${cur ? ` ${cur}` : ""}`;
}

/** Compact money for board headers / tiles, e.g. "₹12.5L" / "$1.2M". */
export function formatMoneyCompact(amount: string | null | undefined, currency: string): string {
  const n = parseDecimal(amount);
  if (n === null) return "—";
  const cur = currency.toUpperCase();
  try {
    return new Intl.NumberFormat(cur === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency: cur,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  } catch {
    return `${n} ${cur}`;
  }
}

/** Probability from a decimal string: "40.00" -> "40%", "33.50" -> "33.5%". */
export function formatPercent(pct: string | null | undefined): string {
  const n = parseDecimal(pct);
  if (n === null) return "—";
  return `${Number.isInteger(n) ? n : Number(n.toFixed(2))}%`;
}

/** "Weighted" cell text: weighted amount plus the probability it came from. */
export function formatWeighted(weighted: string, currency: string, probability: string): string {
  return `${formatMoney(weighted, currency)} (${formatPercent(probability)})`;
}

/** One line per currency: "₹10,00,000 · weighted ₹4,00,000". */
export function formatTotals(totals: readonly CurrencyTotal[], compact = true): string[] {
  const f = compact ? formatMoneyCompact : formatMoney;
  return totals.map((t) => `${f(t.estimated, t.currency)} · wtd ${f(t.weighted, t.currency)}`);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

/** Local `YYYY-MM-DD`. */
export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Monday of the current week (for "New this week"). */
export function startOfWeek(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return isoDate(d);
}

/** Stable random key (Idempotency-Key). */
export function newKey(): string {
  return crypto.randomUUID();
}
