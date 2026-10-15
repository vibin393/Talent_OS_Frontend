import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/auth-frame";
import { FindWorkspaceForm } from "@/features/auth/find-workspace-form";

export const metadata: Metadata = { title: "Find my workspace" };

export default function FindWorkspacePage() {
  return (
    <AuthCard
      title="Find my workspace"
      description="Enter your email and we’ll send you a link to each workspace you belong to."
    >
      <FindWorkspaceForm />
    </AuthCard>
  );
}
