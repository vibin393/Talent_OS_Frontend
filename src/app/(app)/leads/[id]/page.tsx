import type { Metadata } from "next";
import { LeadDetail } from "@/features/crm/leads/lead-detail";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({ params }: PageProps<"/leads/[id]">) {
  const { id } = await params;
  return <LeadDetail key={id} leadId={id} />;
}
