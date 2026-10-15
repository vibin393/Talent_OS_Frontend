import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 10;

const workspace = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your workspace")
  .max(63, "Workspace is too long")
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "Use the workspace ID from your invitation: letters, digits and hyphens, not starting or ending with a hyphen",
  );
const email = z.string().trim().min(1, "Enter your email").pipe(z.email("Enter a valid email address"));

export const loginSchema = z.object({
  tenant_slug: workspace,
  email,
  password: z.string().min(1, "Enter your password"),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
      .max(1024, "Password is too long"),
    confirm: z.string().min(1, "Confirm your password"),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export const acceptInviteSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name").max(200, "Name is too long"),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
      .max(1024, "Password is too long"),
    confirm: z.string().min(1, "Confirm your password"),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });
export type AcceptInviteValues = z.infer<typeof acceptInviteSchema>;
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;

export const forgotPasswordSchema = z.object({ tenant_slug: workspace, email });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const findWorkspaceSchema = z.object({ email });
export type FindWorkspaceValues = z.infer<typeof findWorkspaceSchema>;
