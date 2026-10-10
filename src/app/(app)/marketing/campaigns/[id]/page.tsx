import type { Metadata } from "next";
import { CampaignDetail } from "@/features/campaigns/campaign-detail";

export const metadata: Metadata = { title: "Campaign" };

/** `/marketing/campaigns/[id]` (Epic 39). */
export default async function CampaignPage({ params }: PageProps<"/marketing/campaigns/[id]">) {
  const { id } = await params;
  return <CampaignDetail key={id} campaignId={id} />;
}
