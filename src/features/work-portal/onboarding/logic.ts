/** Worker onboarding form rules (zod), status chips and the draft autosave debouncer. The server re-validates. */
import type { BadgeProps } from "@fluentui/react-components";
import { z } from "zod";
import { bankSchema } from "../validation";
import type { PortalTask, PortalTaskStatus } from "./api";

export { bankSchema };

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_RE = /^\+?[0-9 ()-]{6,20}$/;
const AMOUNT = z
  .string()
  .trim()
  .regex(/^(\d{1,9}(\.\d{1,2})?)?$/, "Enter an amount, e.g. 150000")
  .optional();

export const taxSchema = z.object({
  pan: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => PAN_RE.test(v), "Enter a valid PAN, e.g. ABCDE1234F"),
  pan_name: z.string().trim().max(200).optional(),
  regime: z.enum(["old", "new"]).optional(),
  section_80c: AMOUNT,
  section_80d: AMOUNT,
  hra_rent: AMOUNT,
  home_loan_interest: AMOUNT,
  other: AMOUNT,
});
export type TaxForm = z.input<typeof taxSchema>;

export const emergencySchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(200),
  relation: z.string().trim().max(100).optional(),
  phone: z.string().trim().regex(PHONE_RE, "Enter a valid phone number"),
});
export type EmergencyForm = z.input<typeof emergencySchema>;

export const personalSchema = z.object({
  date_of_birth: z.string().trim().regex(DATE_RE, "Enter the date of birth"),
  father_or_spouse_name: z.string().trim().max(200).optional(),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || PHONE_RE.test(v), "Enter a valid phone number")
    .optional(),
  current_address: z.string().trim().min(1, "Enter your current address").max(500),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  permanent_address: z.string().trim().max(500).optional(),
});
export type PersonalForm = z.input<typeof personalSchema>;

export const AADHAAR_LAST4_RE = /^\d{4}$/;
const FULL_AADHAAR_RE = /(?<!\d)\d{4}[\s-]?\d{4}[\s-]?\d{4}(?!\d)/;

/** True when a free-text value looks like a full 12-digit Aadhaar number (never accepted). */
export function looksLikeFullAadhaar(value: string): boolean {
  return FULL_AADHAAR_RE.test(value);
}

/** `{field: message}` of the first issue per field (empty when valid). */
export function zodErrors<T>(schema: z.ZodType<T>, values: unknown): Record<string, string> {
  const res = schema.safeParse(values);
  if (res.success) return {};
  const out: Record<string, string> = {};
  for (const issue of res.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function taxPayload(v: TaxForm, mode: string): Record<string, unknown> {
  const parsed = taxSchema.parse(v);
  const declarations: Record<string, string> = {};
  for (const k of ["section_80c", "section_80d", "hra_rent", "home_loan_interest", "other"] as const) {
    const amount = parsed[k];
    if (amount) declarations[k] = amount;
  }
  const form = mode !== "upload" && parsed.regime;
  return {
    pan: parsed.pan,
    pan_name: parsed.pan_name || undefined,
    ...(form ? { regime: parsed.regime, declarations } : {}),
  };
}

export type Chip = { label: string; color: BadgeProps["color"] };

export const STATUS_CHIPS: Record<PortalTaskStatus, Chip> = {
  pending: { label: "To do", color: "informative" },
  returned: { label: "Returned", color: "warning" },
  submitted: { label: "Submitted", color: "brand" },
  approved: { label: "Approved", color: "success" },
  waived: { label: "Not needed", color: "subtle" },
};

export function chipFor(status: PortalTaskStatus): Chip {
  return STATUS_CHIPS[status];
}

export function isOpen(t: Pick<PortalTask, "status">): boolean {
  return t.status === "pending" || t.status === "returned";
}

/** Open tasks first (returned before to-do), then submitted, then done. */
export function sortTasks(tasks: PortalTask[]): PortalTask[] {
  const rank: Record<PortalTaskStatus, number> = { returned: 0, pending: 1, submitted: 2, approved: 3, waived: 4 };
  return [...tasks].sort((a, b) => rank[a.status] - rank[b.status]);
}

/** Drafts never carry account / PAN / Aadhaar numbers (re-entered on submit). */
export function safeDraft(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (/^(account_number.*|pan|aadhaar.*)$/i.test(k)) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Debounced autosave: `push(value)` restarts the timer; after `ms` of quiet the latest value is saved. A failed
 * save keeps the value and retries on the next push (offline tolerant); `flush()` saves immediately.
 */
export function createDebouncer<T>(save: (value: T) => Promise<unknown>, ms = 1200) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: T | undefined;
  let has = false;
  const run = async (): Promise<boolean> => {
    timer = null;
    if (!has) return true;
    const value = pending as T;
    has = false;
    try {
      await save(value);
      return true;
    } catch {
      if (!has) {
        pending = value;
        has = true;
      }
      return false;
    }
  };
  return {
    push(value: T) {
      pending = value;
      has = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void run(), ms);
    },
    flush: () => {
      if (timer) clearTimeout(timer);
      return run();
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      has = false;
    },
  };
}
