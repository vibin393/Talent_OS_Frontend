import type { Metadata } from "next";
import { VendorScorecardView } from "@/features/vendor-portal/other-views";

export const metadata: Metadata = { title: "Scorecard" };

export default function VendorScorecardPage() {
  return <VendorScorecardView />;
}
