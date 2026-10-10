import type { Metadata } from "next";
import { OnboardingTemplatesAdmin } from "@/features/onboarding/templates-admin";

export const metadata: Metadata = { title: "Onboarding templates" };

export default function Page() {
  return <OnboardingTemplatesAdmin />;
}
