import type { Metadata } from "next";
import { AssessmentsList } from "@/features/assessments/assessments-list";

export const metadata: Metadata = { title: "Assessments" };

export default function Page() {
  return <AssessmentsList />;
}
