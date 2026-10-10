import type { Metadata } from "next";
import { ReviewView } from "@/features/vendors/review-view";

export const metadata: Metadata = { title: "Vendor submissions" };

export default function VendorReviewPage() {
  return <ReviewView />;
}
