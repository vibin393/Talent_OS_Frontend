import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/auth-frame";
import { AcceptInviteForm } from "@/features/auth/accept-invite-form";

export const metadata: Metadata = { title: "Accept invitation", referrer: "no-referrer" };

export default async function AcceptInvitePage({ searchParams }: PageProps<"/accept-invite">) {
  const { token } = await searchParams;
  return (
    <AuthCard title="Accept invitation" description="Set up your account to get started.">
      <AcceptInviteForm initialToken={typeof token === "string" ? token : undefined} />
    </AuthCard>
  );
}
