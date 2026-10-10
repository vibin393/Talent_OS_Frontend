/** Client-side validation of the Worker bank-change form (the server re-validates; HR approval is required). */
import { z } from "zod";

export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const bankSchema = z
  .object({
    holder_name: z.string().trim().min(1, "Enter the account holder's name").max(200),
    account_number: z
      .string()
      .trim()
      .regex(/^[0-9]{6,20}$/, "Enter 6 to 20 digits"),
    account_number_confirm: z.string().trim(),
    ifsc: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => IFSC_RE.test(v), "Enter a valid IFSC, e.g. HDFC0001234"),
    bank_name: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.account_number === v.account_number_confirm, {
    message: "The account numbers do not match",
    path: ["account_number_confirm"],
  });

export type BankForm = z.input<typeof bankSchema>;

/** `{field: message}` of the first issue per field (empty when valid). */
export function bankErrors(form: BankForm): Record<string, string> {
  const res = bankSchema.safeParse(form);
  if (res.success) return {};
  const out: Record<string, string> = {};
  for (const issue of res.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function maskedAccount(last4: string | null | undefined): string {
  return last4 ? `•••• ${last4}` : "—";
}
