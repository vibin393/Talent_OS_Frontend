import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/auth-frame";
import { SignupForm } from "@/features/auth/signup-form";

export const metadata: Metadata = { title: "Create your company" };

export default function SignupPage() {
  return (
    <AuthCard
      title="Create your company"
      description="Set up a new unified workspace. You’ll get an admin invitation link to finish."
    >
      <SignupForm />
    </AuthCard>
  );
}
