import type { Metadata } from "next";
import { VerificationReview } from "@/features/developers/verification-review";

export const metadata: Metadata = { title: "Developer verification" };

export default function Page() {
  return <VerificationReview />;
}
