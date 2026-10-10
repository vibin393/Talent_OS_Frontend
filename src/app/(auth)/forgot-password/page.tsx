import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/auth-frame";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Forgot your password?" description="We’ll email you a link to set a new one.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
