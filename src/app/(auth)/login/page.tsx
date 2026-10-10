import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/auth-frame";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, mfa, sso_error } = await searchParams;
  return (
    <AuthCard title="Sign in" description="Use your Talent OS workspace account.">
      <LoginForm
        next={typeof next === "string" ? next : undefined}
        mfa={mfa === "1"}
        ssoError={typeof sso_error === "string" ? sso_error : undefined}
      />
    </AuthCard>
  );
}
