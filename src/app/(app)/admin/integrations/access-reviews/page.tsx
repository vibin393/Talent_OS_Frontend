import type { Metadata } from "next";
import { AccessReviewsPage } from "@/features/ecosystem-console/access-reviews/list-page";

export const metadata: Metadata = { title: "Access reviews" };

export default function Page() {
  return <AccessReviewsPage />;
}
