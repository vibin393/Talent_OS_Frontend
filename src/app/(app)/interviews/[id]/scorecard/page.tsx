import type { Metadata } from "next";
import { ScorecardPage } from "@/features/interviews/scorecard-page";

export const metadata: Metadata = { title: "Scorecard" };

export default async function Page({ params }: PageProps<"/interviews/[id]/scorecard">) {
  const { id } = await params;
  return <ScorecardPage key={id} interviewId={id} />;
}
