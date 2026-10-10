import type { Metadata } from "next";
import { VendorPlacementsView } from "@/features/vendor-portal/other-views";

export const metadata: Metadata = { title: "Placements" };

export default function VendorPlacementsPage() {
  return <VendorPlacementsView />;
}
