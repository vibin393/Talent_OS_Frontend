import type { Metadata } from "next";
import { MarketplaceReviewDetail } from "@/features/platform/marketplace-review/review-detail";

export const metadata: Metadata = { title: "Marketplace review" };

export default async function Page({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  return <MarketplaceReviewDetail versionId={versionId} />;
}
