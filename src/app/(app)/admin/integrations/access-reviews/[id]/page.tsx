import type { Metadata } from "next";
import { AccessReviewDetailPage } from "@/features/ecosystem-console/access-reviews/detail-page";

export const metadata: Metadata = { title: "Access review" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AccessReviewDetailPage key={id} reviewId={id} />;
}
