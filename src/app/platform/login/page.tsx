import type { Metadata } from "next";
import { AuthCard, AuthFrame } from "@/features/auth/auth-frame";
import { PlatformLoginForm } from "@/features/platform/platform-login";

export const metadata: Metadata = { title: "Platform admin sign in", referrer: "no-referrer" };

export default async function PlatformLoginPage({ searchParams }: PageProps<"/platform/login">) {
  const { next } = await searchParams;
  return (
    <AuthFrame>
      <AuthCard title="Platform admin" description="Sign in with your Talent OS operator account.">
        <PlatformLoginForm next={typeof next === "string" ? next : undefined} />
      </AuthCard>
    </AuthFrame>
  );
}
