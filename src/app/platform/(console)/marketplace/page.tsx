import type { Metadata } from "next";
import { MarketplaceReviewQueue } from "@/features/platform/marketplace-review/review-queue";

export const metadata: Metadata = { title: "Marketplace review" };

export default function Page() {
  return <MarketplaceReviewQueue />;
}
