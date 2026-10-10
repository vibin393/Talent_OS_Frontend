import type { Metadata } from "next";
import { CampaignsView } from "@/features/campaigns/campaigns-view";

export const metadata: Metadata = { title: "Campaigns" };

/** `/marketing/campaigns` (Epic 39). */
export default function CampaignsPage() {
  return <CampaignsView />;
}
