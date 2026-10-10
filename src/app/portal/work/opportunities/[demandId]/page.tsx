import type { Metadata } from "next";
import { WorkOpportunityDetail } from "@/features/mobility/board/opening-detail";

export const metadata: Metadata = { title: "Opportunity" };

export default async function Page({ params }: PageProps<"/portal/work/opportunities/[demandId]">) {
  const { demandId } = await params;
  return <WorkOpportunityDetail key={demandId} demandId={demandId} />;
}
