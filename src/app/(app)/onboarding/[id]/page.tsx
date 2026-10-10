import type { Metadata } from "next";
import { OnboardingCaseView } from "@/features/onboarding/case-view";

export const metadata: Metadata = { title: "Onboarding case" };

export default async function OnboardingCasePage({ params }: PageProps<"/onboarding/[id]">) {
  const { id } = await params;
  return <OnboardingCaseView key={id} id={id} />;
}
