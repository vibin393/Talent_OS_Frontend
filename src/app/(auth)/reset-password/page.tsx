import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/auth-frame";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata: Metadata = { title: "Set a new password", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  return (
    <AuthCard title="Set a new password" description="Choose a new password for your account.">
      <ResetPasswordForm initialToken={typeof token === "string" ? token : undefined} />
    </AuthCard>
  );
}
