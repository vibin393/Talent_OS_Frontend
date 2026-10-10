import type { Metadata } from "next";
import { CampaignWizard } from "@/features/campaigns/campaign-wizard";

export const metadata: Metadata = { title: "New campaign" };

/** `/marketing/campaigns/new` (Epic 39). */
export default function NewCampaignPage() {
  return <CampaignWizard />;
}
