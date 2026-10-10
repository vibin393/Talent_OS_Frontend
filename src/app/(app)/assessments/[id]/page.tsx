import type { Metadata } from "next";
import { AssessmentBuilder } from "@/features/assessments/builder";

export const metadata: Metadata = { title: "Assessment" };

export default async function Page({ params }: PageProps<"/assessments/[id]">) {
  const { id } = await params;
  return <AssessmentBuilder key={id} id={id} />;
}
