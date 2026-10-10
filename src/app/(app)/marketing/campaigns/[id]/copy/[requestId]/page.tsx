import type { Metadata } from "next";
import { CopyReviewPage } from "@/features/campaigns/copy/review-page";

export const metadata: Metadata = { title: "AI copy drafts" };

/** `/marketing/campaigns/[id]/copy/[requestId]` (Epic 78): review, approve and use AI-drafted copy. */
export default async function CampaignCopyPage({ params }: { params: Promise<{ id: string; requestId: string }> }) {
  const { id, requestId } = await params;
  return <CopyReviewPage key={requestId} campaignId={id} requestId={requestId} />;
}
