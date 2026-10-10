import type { Metadata } from "next";
import { PublicSummaryView } from "@/features/fairness/public-summary-view";

export const metadata: Metadata = { title: "Bias audit summaries" };

/** Published bias-audit summaries (Epic 49, NYC LL144). Branding comes from the careers layout. */
export default async function FairnessSummaryPage({ params }: PageProps<"/careers/[tenant]/fairness">) {
  const { tenant } = await params;
  return <PublicSummaryView slug={tenant} />;
}
