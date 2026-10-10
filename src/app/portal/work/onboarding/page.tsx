import type { Metadata } from "next";
import { WorkOnboarding } from "@/features/work-portal/onboarding/portal-onboarding";

export const metadata: Metadata = { title: "Onboarding" };

export default function Page() {
  return <WorkOnboarding />;
}
