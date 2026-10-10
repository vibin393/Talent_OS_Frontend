import type { Metadata } from "next";
import { ReviewQueue } from "@/features/assessments/review-queue";

export const metadata: Metadata = { title: "Assessment reviews" };

export default function Page() {
  return <ReviewQueue />;
}
