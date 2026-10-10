import type { Metadata } from "next";
import { OpportunityDetail } from "@/features/crm/opportunities/opportunity-detail";

export const metadata: Metadata = { title: "Opportunity" };

export default async function OpportunityPage({ params }: PageProps<"/opportunities/[id]">) {
  const { id } = await params;
  return <OpportunityDetail key={id} opportunityId={id} />;
}
