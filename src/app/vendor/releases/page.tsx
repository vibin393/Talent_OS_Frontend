import type { Metadata } from "next";
import { VendorReleasesView } from "@/features/vendor-portal/releases";

export const metadata: Metadata = { title: "Releases" };

export default function VendorReleasesPage() {
  return <VendorReleasesView />;
}
