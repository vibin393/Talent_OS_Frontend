import type { Metadata } from "next";
import { OnboardingBoard } from "@/features/onboarding/onboarding-board";

export const metadata: Metadata = { title: "Onboarding" };

export default function OnboardingPage() {
  return <OnboardingBoard />;
}
