/** Offer terms form: values, zod validation, live margin, approval-relevant change detection and PATCH payload. */
import { z } from "zod";
import type { EmploymentType, OfferStatus, OfferUpdate, OfferVersionOut, RateUnit, WorkMode } from "./types";

export type TermsValues = {
  title: string;
  employment_type: EmploymentType;
  pay_amount: string;
  pay_currency: string;
  pay_rate_unit: RateUnit;
  bill_amount: string;
  bill_currency: string;
  bill_rate_unit: RateUnit | "";
  bonus_amount: string;
  bonus_currency: string;
  benefits_summary: string;
  start_date: string;
  end_date: string;
  location: string;
  work_mode: WorkMode | "";
  expiry_date: string;
  template_id: string;
};

export function termsFromVersion(v: OfferVersionOut): TermsValues {
  return {
    title: v.title,
    employment_type: v.employment_type,
    pay_amount: v.pay_rate.amount,
    pay_currency: v.pay_rate.currency,
    pay_rate_unit: v.pay_rate_unit,
    bill_amount: v.bill_rate?.amount ?? "",
    bill_currency: v.bill_rate?.currency ?? v.pay_rate.currency,
    bill_rate_unit: v.bill_rate_unit ?? "",
    bonus_amount: v.bonus?.amount ?? "",
    bonus_currency: v.bonus?.currency ?? v.pay_rate.currency,
    benefits_summary: v.benefits_summary ?? "",
    start_date: v.start_date,
    end_date: v.end_date ?? "",
    location: v.location ?? "",
    work_mode: v.work_mode ?? "",
    expiry_date: v.expiry_date,
    template_id: v.template_id ?? "",
  };
}

const AMOUNT_RE = /^\d{1,12}(\.\d{1,2})?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** zod schema; `today` is the tenant-local date (YYYY-MM-DD) used for the expiry check. */
export function termsSchema(opts: { today: string; masked: boolean }) {
  return z
    .object({
      title: z.string().trim().min(1, "Enter the job title").max(300),
      employment_type: z.enum(["contract", "contract_to_hire", "permanent", "freelance"]),
      pay_amount: z.string().trim().regex(AMOUNT_RE, "Enter an amount such as 1800 or 1800.50"),
      pay_currency: z.string().trim().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code"),
      pay_rate_unit: z.enum(["hour", "day", "month", "year"]),
      bill_amount: z.string().trim(),
      bill_currency: z.string().trim(),
      bill_rate_unit: z.string(),
      bonus_amount: z.string().trim(),
      bonus_currency: z.string().trim(),
      benefits_summary: z.string().max(5000),
      start_date: z.string().regex(DATE_RE, "Choose a start date"),
      end_date: z.string(),
      location: z.string().max(300),
      work_mode: z.string(),
      expiry_date: z.string().regex(DATE_RE, "Choose an expiry date"),
      template_id: z.string(),
    })
    .superRefine((v, ctx) => {
      const issue = (path: keyof TermsValues, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
      if (AMOUNT_RE.test(v.pay_amount) && Number(v.pay_amount) <= 0) issue("pay_amount", "Pay must be more than zero");
      if (!opts.masked && v.bill_amount) {
        if (!AMOUNT_RE.test(v.bill_amount) || Number(v.bill_amount) <= 0) issue("bill_amount", "Enter a bill rate above zero");
        if (v.bill_currency && v.bill_currency !== v.pay_currency) issue("bill_currency", "Pay and bill currency must match");
      }
      if (v.bonus_amount && (!AMOUNT_RE.test(v.bonus_amount) || Number(v.bonus_amount) <= 0)) issue("bonus_amount", "Enter a bonus above zero or leave it empty");
      if (v.employment_type === "contract" || v.employment_type === "contract_to_hire") {
        if (!DATE_RE.test(v.end_date)) issue("end_date", "Contracts need an end date");
        else if (DATE_RE.test(v.start_date) && v.end_date <= v.start_date) issue("end_date", "The end date must be after the start date");
      } else if (v.end_date && DATE_RE.test(v.start_date) && v.end_date <= v.start_date) {
        issue("end_date", "The end date must be after the start date");
      }
      if (DATE_RE.test(v.expiry_date) && v.expiry_date < opts.today) issue("expiry_date", "The expiry date is in the past");
    });
}

/** Field → message map from a zod result (first message per field). */
export function termsErrors(values: TermsValues, opts: { today: string; masked: boolean }): Partial<Record<keyof TermsValues, string>> {
  const r = termsSchema(opts).safeParse(values);
  if (r.success) return {};
  const out: Partial<Record<keyof TermsValues, string>> = {};
  for (const i of r.error.issues) {
    const key = i.path[0] as keyof TermsValues;
    if (key && !out[key]) out[key] = i.message;
  }
  return out;
}

/** Fields whose change on an approved / released offer creates a new version that needs re-approval (spec A4). */
export const APPROVAL_FIELDS: readonly (keyof TermsValues)[] = [
  "pay_amount",
  "pay_currency",
  "pay_rate_unit",
  "bonus_amount",
  "bill_amount",
  "bill_rate_unit",
  "start_date",
  "employment_type",
];

function norm(key: keyof TermsValues, v: string): string {
  return key.endsWith("_amount") && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v).toFixed(2) : v.trim();
}

export function changedFields(initial: TermsValues, values: TermsValues): (keyof TermsValues)[] {
  return (Object.keys(values) as (keyof TermsValues)[]).filter((k) => norm(k, String(initial[k])) !== norm(k, String(values[k])));
}

export function approvalRelevantChanged(initial: TermsValues, values: TermsValues): boolean {
  return changedFields(initial, values).some((k) => APPROVAL_FIELDS.includes(k));
}

export type SaveMode = "edit" | "new_version_reapproval" | "new_version" | "locked" | "terminal";

/** How saving behaves for the offer's status and the changed fields. */
export function saveMode(status: OfferStatus, initial: TermsValues, values: TermsValues): SaveMode {
  if (status === "draft") return "edit";
  if (status === "pending_approval") return "locked";
  if (status === "approved" || status === "released" || status === "viewed") {
    return approvalRelevantChanged(initial, values) ? "new_version_reapproval" : "new_version";
  }
  return "terminal";
}

const MULTIPLIER: Record<RateUnit, number> = { hour: 1, day: 8, month: 168, year: 2016 };

export type MarginView = { amount: number; pct: number; currency: string; unit: RateUnit; color: "success" | "warning" | "danger"; belowMin: boolean };

/**
 * Live margin: bill − pay × (1 + burden%), as an amount per bill unit and a percentage of bill. Pay is converted
 * to the bill unit with 8 h/day, 168 h/month, 2016 h/year when the units differ. Null when not computable.
 */
export function liveMargin(v: TermsValues, burdenPct: number, minMarginPct: number | null): MarginView | null {
  const pay = Number(v.pay_amount);
  const bill = Number(v.bill_amount);
  if (!v.bill_amount || !Number.isFinite(pay) || !Number.isFinite(bill) || bill <= 0 || pay <= 0) return null;
  if (v.bill_currency && v.bill_currency !== v.pay_currency) return null;
  const billUnit = (v.bill_rate_unit || v.pay_rate_unit) as RateUnit;
  const payInBill = (pay / MULTIPLIER[v.pay_rate_unit]) * MULTIPLIER[billUnit];
  const cost = payInBill * (1 + (Number.isFinite(burdenPct) ? burdenPct : 0) / 100);
  const amount = Math.round((bill - cost) * 100) / 100;
  const pct = Math.round((amount / bill) * 1000) / 10;
  const min = minMarginPct ?? null;
  const belowMin = min !== null && pct < min;
  const color = belowMin || pct < 0 ? "danger" : min !== null && pct < min + 5 ? "warning" : "success";
  return { amount, pct, currency: v.pay_currency, unit: billUnit, color, belowMin };
}

function money(amount: string, currency: string) {
  return { amount: Number(amount).toFixed(2), currency };
}

/** PATCH body with only the changed fields (bill fields never sent when masked). */
export function toUpdatePayload(initial: TermsValues, values: TermsValues, lockVersion: number, masked: boolean): OfferUpdate {
  const changed = new Set(changedFields(initial, values));
  const body: OfferUpdate = { lock_version: lockVersion };
  const has = (...keys: (keyof TermsValues)[]) => keys.some((k) => changed.has(k));
  if (has("title")) body.title = values.title.trim();
  if (has("employment_type")) body.employment_type = values.employment_type;
  if (has("pay_amount", "pay_currency")) body.pay_rate = money(values.pay_amount, values.pay_currency);
  if (has("pay_rate_unit")) body.pay_rate_unit = values.pay_rate_unit;
  if (!masked && values.bill_amount && has("bill_amount", "bill_currency", "pay_currency")) body.bill_rate = money(values.bill_amount, values.bill_currency || values.pay_currency);
  if (!masked && values.bill_rate_unit && has("bill_rate_unit")) body.bill_rate_unit = values.bill_rate_unit;
  if (has("bonus_amount", "bonus_currency") && values.bonus_amount) body.bonus = money(values.bonus_amount, values.bonus_currency || values.pay_currency);
  if (has("benefits_summary")) body.benefits_summary = values.benefits_summary;
  if (has("start_date")) body.start_date = values.start_date;
  if (has("end_date") && values.end_date) body.end_date = values.end_date;
  if (has("location")) body.location = values.location;
  if (has("work_mode") && values.work_mode) body.work_mode = values.work_mode;
  if (has("expiry_date")) body.expiry_date = values.expiry_date;
  if (has("template_id") && values.template_id) body.template_id = values.template_id;
  return body;
}
