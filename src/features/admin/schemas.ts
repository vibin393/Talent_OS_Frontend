import { z } from "zod";
import { ROLE_KEY_PATTERN } from "./role-grants";

const name = z.string().trim().min(1, "Enter a name").max(200, "Use at most 200 characters");
const description = z.string().trim().max(1000, "Use at most 1000 characters");

export const orgUnitSchema = z.object({ name, description });
export type OrgUnitValues = z.infer<typeof orgUnitSchema>;

export const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter an email address")
    .max(254, "Email is too long")
    .pipe(z.email("Enter a valid email address")),
  name: z.string().trim().max(200, "Use at most 200 characters"),
  role_ids: z.array(z.string()).min(1, "Choose at least one role"),
  business_unit_id: z.string().nullable(),
  team_ids: z.array(z.string()),
});
export type InviteValues = z.infer<typeof inviteSchema>;

export const roleSchema = z.object({
  name,
  key: z
    .string()
    .trim()
    .regex(ROLE_KEY_PATTERN, "2-64 characters: lowercase letters, digits and underscores, starting with a letter"),
  description,
});
export type RoleFormValues = z.infer<typeof roleSchema>;

/** Optional text: blank becomes `null` (clears the field on the server). */
export function optionalText(value: string): string | null {
  const v = value.trim();
  return v === "" ? null : v;
}
