import type { Metadata } from "next";
import { PortalAssessmentsList } from "@/features/assessments/portal-assessments";

export const metadata: Metadata = { title: "My assessments" };

export default function Page() {
  return <PortalAssessmentsList />;
}
