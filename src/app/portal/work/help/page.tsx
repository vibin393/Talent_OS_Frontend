import type { Metadata } from "next";
import { WorkHelp } from "@/features/work-portal/help/help-page";

export const metadata: Metadata = { title: "Onboarding help" };

export default function Page() {
  return <WorkHelp />;
}
