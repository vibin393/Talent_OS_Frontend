import type { Metadata } from "next";
import { MarketingOverview } from "@/features/campaigns/marketing-overview";

export const metadata: Metadata = { title: "Recruitment marketing" };

/** `/marketing` (Epic 39): funnel overview. */
export default function MarketingPage() {
  return <MarketingOverview />;
}
