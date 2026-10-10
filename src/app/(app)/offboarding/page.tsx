import type { Metadata } from "next";
import { OffboardingCasesView } from "@/features/placement-exit/offboarding-cases-view";

export const metadata: Metadata = { title: "Offboarding" };

export default function OffboardingPage() {
  return <OffboardingCasesView />;
}
